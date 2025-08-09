const Jimp = require("jimp");
const Pixel = require("../models/pixel");
const ActionLogger = require("../util/ActionLogger");
const fs = require("fs");
const path = require("path");

const regenerationInterval = 30; // in seconds

function PaintingManager(app) {
    const imageSize = app.config.boardSize;
    const cachedImagePath = path.resolve(app.dataFolder, "cached-board-image.png");
    const temporaryCachedImagePath = path.resolve(app.dataFolder, "cached-board-image.png.tmp");
    return {
        hasImage: false,
        imageHasChanged: false,
        image: null,
        outputImage: null,
        waitingForImages: [],
        lastPixelUpdate: null,
        firstGenerateAfterLoad: false,
        pixelsToPaint: [],
        pixelsToPreserve: null,
        isGenerating: false,

        createNewImage: function() {
            return new Jimp(imageSize, imageSize, 0xFFFFFFFF);
        },

        getStartingImage: async function() {
            try {
                const image = await Jimp.read(cachedImagePath);
                if (image.bitmap.width != imageSize || image.bitmap.height != imageSize) return { image: await this.createNewImage(), canServe: false, skipImmediateCache: false };
                return { image, canServe: true, skipImmediateCache: true };
            } catch (e) {
                return { image: await this.createNewImage(), canServe: false, skipImmediateCache: false };
            }
        },

        loadImageFromDatabase: function() {
            var hasServed = false;
            return new Promise((resolve, reject) => {
                var serveImage = async (image, skipImmediateCache = false) => {
                    this.hasImage = true;
                    this.image = image;
                    this.firstGenerateAfterLoad = true;
                    await this.generateOutputImage(skipImmediateCache);
                    if (!hasServed) resolve(image);
                    hasServed = true;
                }
                this.getStartingImage().then(async ({image, canServe, skipImmediateCache}) => {
                    if (canServe) {
                        app.logger.info("Startup", `Got initially serveable image, serving...`);
                        this.pixelsToPreserve = [];
                        await serveImage(image, skipImmediateCache);
                    }
                    (async () => {
                        try {
                            const count = await Pixel.count({});
                            var loaded = 0;
                            var progressUpdater = setInterval(() => {
                                app.logger.info("Startup", `Loaded ${loaded.toLocaleString()} of ${count.toLocaleString()} pixel${count == 1 ? "" : "s"} (${Math.round(loaded / count * 100)}% complete)`);
                            }, 2500);
                            for await (const pixel of Pixel.find({}).cursor()) {
                            const x = pixel.xPos, y = pixel.yPos;
                            
                            if (x >= 0 && y >= 0 && x < imageSize && y < imageSize) {
                                if (pixel.type === 'image') {
                                    // For image pixels, we'll store them separately and composite later
                                    // For now, just set a placeholder color
                                    const placeholderColor = Jimp.cssColorToHex('#FFFF00'); // Yellow placeholder
                                    image.setPixelColor(placeholderColor, x, y);
                                } else {
                                    // Regular color pixel
                                    const hex = Jimp.cssColorToHex(pixel.getHexColour());
                                    image.setPixelColor(hex, x, y);
                                }
                            }
                            loaded++;
                        }
                            clearInterval(progressUpdater);
                            app.logger.info("Startup", `Loaded total ${count.toLocaleString()} pixel${count == 1 ? "" : "s"} pixels from database. Applying to image...`);
                            if (this.pixelsToPreserve) this.pixelsToPreserve.forEach((data) => image.setPixelColor(data.colour, data.x, data.y));
                            this.pixelsToPreserve = null;
                            app.logger.info("Startup", `Applied pixels to image. Serving image...`);
                            serveImage(image);
                        } catch (err) {
                            this.pixelsToPreserve = null;
                            reject(err);
                        }
                    })();
                }).catch((err) => reject(err));
            });
        },

        getOutputImage: function() {
            return new Promise((resolve, reject) => {
                if (this.outputImage) return resolve({image: this.outputImage, hasChanged: this.imageHasChanged, generated: this.lastPixelUpdate});
                this.waitingForImages.push((err, buffer) => {
                    this.getOutputImage().then((data) => resolve(data)).catch((err) => reject(err));
                })
            })
        },

        generateOutputImage: function(skipImmediateCache = false) {
            var a = this;
            return new Promise((resolve, reject) => {
                if (a.isGenerating) return reject();
                a.isGenerating = true;
                this.waitingForImages.push((err, buffer) => {
                    if (err) return reject(err);
                    resolve(buffer);
                })
                if(this.waitingForImages.length == 1) {
                    this.lastPixelUpdate = Math.floor(Date.now() / 1000);
                    this.pixelsToPaint.forEach((data) => {
                        // Paint on live image:
                        this.image.setPixelColor(data.colour, data.x, data.y);
                    });
                    this.pixelsToPaint = [];
                    this.image.getBufferAsync(Jimp.MIME_PNG).then((buffer) => {
                        a.outputImage = buffer;
                        if (!skipImmediateCache) {
                            fs.writeFile(temporaryCachedImagePath, buffer, (err) => {
                                if (err) return app.logger.error("Painting Manager", "Couldn't save cached board image, got error:", err);
                                if (fs.existsSync(cachedImagePath)) fs.unlinkSync(cachedImagePath);
                                fs.rename(temporaryCachedImagePath, cachedImagePath, (err) => { 
                                    if (err) return app.logger.error("Painting Manager", "Couldn't move cached board image into place, got error:", err)
                                    app.logger.info("Painting Manager", "Saved cached board image successfully!");
                                })
                            });
                        }
                        a.waitingForImages.forEach((callback) => callback(null, buffer));
                        a.waitingForImages = [];
                    }).catch((err) => {
                        app.logger.error("Could not generate output image:", err);
                        a.waitingForImages.forEach((callback) => callback(err, null));
                        a.waitingForImages = [];
                    }).then(() => {
                        a.isGenerating = false;
                        a.imageHasChanged = false;
                        if (a.firstGenerateAfterLoad) {
                            app.websocketServer.broadcast("server_ready");
                            a.firstGenerateAfterLoad = false;
                        }
                    });
                }
            })
        },

        getColourRGB: function(hex) {
            var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        },

        doPaint: function(colour, x, y, user) {
            var a = this;
            return new Promise((resolve, reject) => {
                if (!this.hasImage) return reject({message: "Our servers are currently getting ready. Please try again in a moment.", code: "not_ready"});
                if (app.temporaryUserInfo.isUserPlacing(user)) return reject({message: "You cannot place more than one tile at once.", code: "attempted_overload"});
                app.temporaryUserInfo.setUserPlacing(user, true);
                // Add to DB:
                user.addPixel(colour, x, y, app, (changed, err) => {
                    app.temporaryUserInfo.setUserPlacing(user, false);
                    if (err) return reject(err);
                    const pixelData = { x: x, y: y, colour: Jimp.rgbaToInt(colour.r, colour.g, colour.b, 255) };
                    a.pixelsToPaint.push(pixelData);
                    if (a.pixelsToPreserve) a.pixelsToPreserve.push(pixelData);
                    a.imageHasChanged = true;
                    // Send notice to all clients:
                    var info = {x: x, y: y, colour: Pixel.getHexFromRGB(colour.r, colour.g, colour.b)};
                    app.pixelNotificationManager.pixelChanged(info);
                    ActionLogger.log(app, "place", user, null, info);
                    app.userActivityController.recordActivity(user);
                    app.leaderboardManager.needsUpdating = true;
                    resolve();
                });
            });
        },

        doPaintImage: function(imageUrl, x, y, user) {
            var a = this;
            return new Promise((resolve, reject) => {
                if (!this.hasImage) return reject({message: "Our servers are currently getting ready. Please try again in a moment.", code: "not_ready"});
                if (app.temporaryUserInfo.isUserPlacing(user)) return reject({message: "You cannot place more than one tile at once.", code: "attempted_overload"});
                
                // For image pixels, we'll use a placeholder color in the main canvas
                // The actual image rendering will be handled by the frontend
                const placeholderColor = Jimp.rgbaToInt(255, 255, 0, 255); // Yellow placeholder
                const pixelData = { x: x, y: y, colour: placeholderColor, type: 'image', imageUrl: imageUrl };
                a.pixelsToPaint.push(pixelData);
                if (a.pixelsToPreserve) a.pixelsToPreserve.push(pixelData);
                a.imageHasChanged = true;
                
                // Send notice to all clients with image info:
                var info = {x: x, y: y, type: 'image', imageUrl: imageUrl};
                app.pixelNotificationManager.pixelChanged(info);
                ActionLogger.log(app, "place_image", user, null, info);
                app.userActivityController.recordActivity(user);
                app.leaderboardManager.needsUpdating = true;
                resolve();
            });
        },

        startTimer: function() {
            setInterval(() => {
                if (this.pixelsToPreserve) return app.logger.log("Painting Manager", "Will not start board image update, as board image is still being completely loaded...");
                if (this.isGenerating) return app.logger.log("Painting Manager", "Will not start board image update, as board image is still being generated...");
                if (!this.imageHasChanged) return app.logger.log("Painting Manager", "Not updating board image, no changes since last update.");
                app.logger.log("Painting Manager", "Starting board image update...");
                this.generateOutputImage();
            }, regenerationInterval * 1000);
        }
    };
}

PaintingManager.prototype = Object.create(PaintingManager.prototype);

module.exports = PaintingManager;
