const gulp = require("gulp");
const uglify = require("gulp-uglify");
const babel = require("gulp-babel");
const sourcemaps = require('gulp-sourcemaps');
const changed = require('gulp-changed');
const del = require("del");

class JavaScriptProcessor {
    constructor(app) {
        this.app = app;
        
        this.paths = {
            scripts: {
                built: "public/js/build",
                src: "client/js/*.js"
            }
        };

        var swallowError = function(error) {
            app.reportError("Error while processing JavaScript: " + error);
            this.emit("end");
        }

        const clean = () => del([this.paths.scripts.built]);

        const scripts = (cb) => {
            this.app.logger.info('Babel', "Processing JavaScript…");
            var t = gulp.src(this.paths.scripts.src);
            t = t.pipe(changed(this.paths.scripts.built))
            t = t.pipe(sourcemaps.init());
            t = t.pipe(babel({ presets: ["@babel/preset-env"] }));
            t = t.on("error", swallowError);
            if(!this.app.config.debug) t = t.pipe(uglify());
            t = t.on("error", swallowError);
            t = t.pipe(sourcemaps.write('.'));
            t = t.pipe(gulp.dest(this.paths.scripts.built));
            t = t.on("end", () => this.app.logger.info('Babel', "Finished processing JavaScript."));
            return t;
        };

        const watch = () => {
            gulp.watch(this.paths.scripts.src, scripts);
        };

        this.processJavaScript = gulp.series(scripts);
        this.watchJavaScript = gulp.series(scripts, watch);
        this.cleanJavaScript = gulp.series(clean);

        this.watchJavaScript();
    }
}

JavaScriptProcessor.prototype = Object.create(JavaScriptProcessor.prototype);

module.exports = JavaScriptProcessor;