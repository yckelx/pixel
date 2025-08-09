const path = require("path");
const fs = require("fs");
const Jimp = require("jimp");
const User = require("../models/user");
const Pixel = require("../models/pixel");

exports.postAPIUploadImage = (req, res, next) => {
    if (fs.existsSync(path.join(__dirname, "../util/", "legit.js"))) {
        if (!req.pass) return res.status(403).json({ success: false, error: { message: "You cannot do that.", code: "unauthorized" } });
    }

    function uploadWithUser(user) {
        if (!user.canPlace(req.place)) return res.status(429).json({ success: false, error: { message: "You cannot place yet.", code: "slow_down" } });
        
        // Expect base64 encoded image in request body
        if (!req.body.imageData) {
            return res.status(400).json({ success: false, error: { message: "No image data provided", code: "no_data" } });
        }

        try {
            // Parse base64 data URL (format: "data:image/png;base64,...")
            const imageDataURL = req.body.imageData;
            const matches = imageDataURL.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
            
            if (!matches) {
                return res.status(400).json({ success: false, error: { message: "Invalid image format. Use PNG or JPG.", code: "invalid_format" } });
            }

            const imageType = matches[1];
            const base64Data = matches[2];
            const imageBuffer = Buffer.from(base64Data, 'base64');

            // Generate unique filename
            const timestamp = Date.now();
            const filename = `${user.id}_${timestamp}_${Math.random().toString(36).substr(2, 9)}.png`;
            const imagePath = path.join(__dirname, "../public/pixel-images", filename);
            const imageUrl = `/pixel-images/${filename}`;

            // Process and save image
            Jimp.read(imageBuffer)
                .then(image => {
                    // Resize to 512x512 pixels for high quality when fully zoomed
                    return image.resize(512, 512, Jimp.RESIZE_BICUBIC);
                })
                .then(image => {
                    // Save the processed image
                    return image.writeAsync(imagePath);
                })
                .then(() => {
                    return res.json({ 
                        success: true, 
                        imageUrl: imageUrl,
                        filename: filename,
                        message: "Image uploaded successfully. Click on canvas to place it." 
                    });
                })
                .catch(err => {
                    req.place.logger.capture(`Error processing image: ${err.message}`, { user: user });
                    return res.status(500).json({ success: false, error: { message: "Error processing image", code: "processing_error" } });
                });

        } catch (err) {
            return res.status(400).json({ success: false, error: { message: "Invalid image data", code: "invalid_data" } });
        }
    }

    uploadWithUser(req.user);
};

exports.postAPIPlaceImagePixel = (req, res, next) => {
    if (fs.existsSync(path.join(__dirname, "../util/", "legit.js"))) {
        if (!req.pass) return res.status(403).json({ success: false, error: { message: "You cannot do that.", code: "unauthorized" } });
    }

    function paintWithUser(user) {
        if (!user.canPlace(req.place)) return res.status(429).json({ success: false, error: { message: "You cannot place yet.", code: "slow_down" } });
        
        if (!req.body.x || !req.body.y || !req.body.imageUrl) {
            return res.status(400).json({ success: false, error: { message: "You need to include all parameters", code: "invalid_parameters" } });
        }

        var x = Number.parseInt(req.body.x), y = Number.parseInt(req.body.y);
        if (Number.isNaN(x) || Number.isNaN(y)) {
            return res.status(400).json({ success: false, error: { message: "Your coordinates were incorrectly formatted", code: "invalid_parameters" } });
        }

        const imageUrl = req.body.imageUrl;
        const imagePath = path.join(__dirname, "../public", imageUrl);

        // Verify image exists and read data
        if (!fs.existsSync(imagePath)) {
            return res.status(400).json({ success: false, error: { message: "Image not found", code: "image_not_found" } });
        }

        const imageData = fs.readFileSync(imagePath);

        // Place the image pixel
        Pixel.addImagePixel(imageUrl, imageData, x, y, user.id, req.place, (success, error) => {
            if (error) {
                return res.status(500).json({ success: false, error: error });
            }

            if (success) {
                // Broadcast the change to all clients
                if (req.place.websocketServer && req.place.websocketServer.broadcast) {
                    req.place.websocketServer.broadcast("pixel_update", {
                        x: x,
                        y: y,
                        type: 'image',
                        imageUrl: imageUrl
                    });
                }

                // Update painting manager
                if (req.place.paintingManager && req.place.paintingManager.doPaintImage) {
                    req.place.paintingManager.doPaintImage(imageUrl, x, y, user);
                }
            }

            return User.findById(user.id).then((user) => {
                var seconds = user.getPlaceSecondsRemaining(req.place);
                var countData = { canPlace: seconds <= 0, seconds: seconds };
                return res.json({ success: true, timer: countData, placed: success });
            }).catch((err) => res.json({ success: true, placed: success }));
        });
    }

    paintWithUser(req.user);
};