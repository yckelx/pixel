const DataModelManager = require("../util/DataModelManager");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

var colourPieceValidator = function(c) {
    return Number.isInteger(c) && c >= 0 && c <= 255;
}

var PixelSchema = new Schema({
    xPos: {
        type: Number,
        required: true,
        validate: {
            validator: Number.isInteger,
            message: "{VALUE} is not an integer value"
        }
    },
    yPos: {
        type: Number,
        required: true,
        validate: {
            validator: Number.isInteger,
            message: "{VALUE} is not an integer value"
        }
    },
    editorID: {
        type: Schema.ObjectId,
        required: false
    },
    lastModified: {
        type: Date,
        required: true
    },
    type: {
        type: String,
        enum: ['color', 'image'],
        default: 'color',
        required: true
    },
    // For color pixels (existing)
    colourR: {
        type: Number,
        required: function() { return this.type === 'color'; },
        validate: {
            validator: function(v) { return this.type !== 'color' || colourPieceValidator(v); },
            message: "{VALUE} is not a valid colour"
        }
    },
    colourG: {
        type: Number,
        required: function() { return this.type === 'color'; },
        validate: {
            validator: function(v) { return this.type !== 'color' || colourPieceValidator(v); },
            message: "{VALUE} is not a valid colour"
        }
    },
    colourB: {
        type: Number,
        required: function() { return this.type === 'color'; },
        validate: {
            validator: function(v) { return this.type !== 'color' || colourPieceValidator(v); },
            message: "{VALUE} is not a valid colour"
        }
    },
    // For image pixels (new)
    imageUrl: {
        type: String,
        required: function() { return this.type === 'image'; }
    },
    imageData: {
        type: Buffer,
        required: function() { return this.type === 'image'; }
    }
});

PixelSchema.methods.toInfo = function(userIDs = true) {
    var info = {
        point: {
            x: this.xPos,
            y: this.yPos
        },
        modified: this.lastModified,
        type: this.type
    };
    
    if (this.type === 'color') {
        info.colour = this.getHexColour();
    } else if (this.type === 'image') {
        info.imageUrl = this.imageUrl;
    }
    
    if (userIDs) info.editorID = this.editorID;
    return info;
}

PixelSchema.statics.addPixel = function(colour, x, y, userID, app, callback) {
    var pn = this;
    x = parseInt(x), y = parseInt(y);
    if(isNaN(x) || isNaN(y)) return callback(null, { message: "Invalid positions provided." });
    if(x < 0 || y < 0 || x >= app.config.boardSize || y >= app.config.boardSize) return callback(null, { message: "Position is out of bounds." });
    this.findOne({
        xPos: x,
        yPos: y
    }).then((pixel) => {
        // Find the pixel at this location
        var wasIdentical = colour.r == 255 && colour.g == 255 && colour.b == 255; // set to identical if pixel was white
        if (pixel && pixel.type === 'color') { // we have color data from the old pixel
            wasIdentical = pixel.editorID == userID && pixel.colourR == colour.r && pixel.colourG == colour.g && pixel.colourB == colour.b;
        }
        if (!wasIdentical) { // if the pixel was changed
            if(!pixel) { // if the spot was blank, create a new one
                pixel = pn({
                    xPos: x,
                    yPos: y,
                    type: 'color'
                });
            }
            // change our appropriate fields
            pixel.type = 'color';
            pixel.editorID = userID;
            pixel.colourR = colour.r;
            pixel.colourG = colour.g;
            pixel.colourB = colour.b;
            pixel.imageUrl = undefined;
            pixel.imageData = undefined;
            pixel.lastModified = Date();
            // save the changes
            pixel.save().then((p) => {
                callback(true, null); // report back that we changed the pixel
            }).catch((err) => {
                app.reportError("Error saving pixel for update: " + err);
                callback(null, { message: "An error occurred while trying to place the pixel." });
            })
        } else {
            // report back that we didn't change the pixel
            return callback(false, null);
        }
    }).catch((err) => {
        app.reportError("Error reading pixel for update: " + err);
        callback(null, { message: "An error occurred while trying to place the pixel." });
    });
}

PixelSchema.statics.addImagePixel = function(imageUrl, imageData, x, y, userID, app, callback) {
    var pn = this;
    x = parseInt(x), y = parseInt(y);
    if(isNaN(x) || isNaN(y)) return callback(null, { message: "Invalid positions provided." });
    if(x < 0 || y < 0 || x >= app.config.boardSize || y >= app.config.boardSize) return callback(null, { message: "Position is out of bounds." });
    this.findOne({
        xPos: x,
        yPos: y
    }).then((pixel) => {
        // Find the pixel at this location
        var wasIdentical = false;
        if (pixel && pixel.type === 'image') { // we have image data from the old pixel
            wasIdentical = pixel.editorID == userID && pixel.imageUrl == imageUrl;
        }
        if (!wasIdentical) { // if the pixel was changed
            if(!pixel) { // if the spot was blank, create a new one
                pixel = pn({
                    xPos: x,
                    yPos: y,
                    type: 'image'
                });
            }
            // change our appropriate fields
            pixel.type = 'image';
            pixel.editorID = userID;
            pixel.imageUrl = imageUrl;
            pixel.imageData = imageData;
            pixel.colourR = undefined;
            pixel.colourG = undefined;
            pixel.colourB = undefined;
            pixel.lastModified = Date();
            // save the changes
            pixel.save().then((p) => {
                callback(true, null); // report back that we changed the pixel
            }).catch((err) => {
                app.reportError("Error saving image pixel for update: " + err);
                callback(null, { message: "An error occurred while trying to place the image pixel." });
            })
        } else {
            // report back that we didn't change the pixel
            return callback(false, null);
        }
    }).catch((err) => {
        app.reportError("Error reading pixel for update: " + err);
        callback(null, { message: "An error occurred while trying to place the pixel." });
    });
}

PixelSchema.methods.getInfo = function(overrideDataAccess = false, app = null) {
    return new Promise((resolve, reject) => {
        let info = this.toInfo();
        require("./user").getPubliclyAvailableUserInfo(this.editorID, overrideDataAccess, app).then((userInfo) => resolve(Object.assign(info, userInfo))).catch((err) => reject(err));
    });
}

PixelSchema.methods.getSocketInfo = function() {
    var info = {x: this.xPos, y: this.yPos, type: this.type};
    if (this.type === 'color') {
        info.colour = this.getHexColour();
    } else if (this.type === 'image') {
        info.imageUrl = this.imageUrl;
    }
    return info;
}

PixelSchema.methods.getHexColour = function() {
    return PixelSchema.statics.getHexFromRGB(this.colourR, this.colourG, this.colourB);
}

PixelSchema.statics.getHexFromRGB = function(r, g, b) {
    // Borrowed partly from: https://stackoverflow.com/a/5624139
    function componentToHex(c) {
        var hex = c.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    }
    return componentToHex(r) + componentToHex(g) + componentToHex(b);
}

PixelSchema.index({xPos: 1, yPos: 1});
module.exports = DataModelManager.registerModel("Pixel", PixelSchema);
