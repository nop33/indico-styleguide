const assembler = require('fabricator-assemble');
const browserSync = require('browser-sync');
const csso = require('gulp-csso');
const del = require('del');
const gulp = require('gulp');
const gutil = require('gulp-util');
const gulpif = require('gulp-if');
const imagemin = require('gulp-imagemin');
const prefix = require('gulp-autoprefixer');
const rename = require('gulp-rename');
const reload = browserSync.reload;
const runSequence = require('run-sequence');
const sass = require('gulp-sass');
const importOnce = require('node-sass-import-once');
const sourcemaps = require('gulp-sourcemaps');
const webpack = require('webpack');
const deploy = require('gulp-gh-pages');
const rework = require('gulp-rework');

const STATIC_BASE = '../static/';

// configuration
const config = {
    dev: gutil.env.dev,
    styles: {
        browsers: 'last 1 version',
        fabricator: {
            src: 'src/assets/fabricator/styles/fabricator.scss',
            dest: 'dist/assets/fabricator/styles',
            watch: 'src/assets/fabricator/styles/**/*.scss',
        },
        toolkit: {
            src: 'src/assets/toolkit/styles/toolkit.scss',
            dest: 'dist/assets/toolkit/styles',
            watch: 'src/assets/toolkit/styles/**/*.scss',
        },
    },
    scripts: {
        fabricator: {
            src: './src/assets/fabricator/scripts/fabricator.js',
            dest: 'dist/assets/fabricator/scripts',
            watch: 'src/assets/fabricator/scripts/**/*',
        },
        toolkit: {
            src: './src/assets/toolkit/scripts/toolkit.js',
            dest: 'dist/assets/toolkit/scripts',
            watch: 'src/assets/toolkit/scripts/**/*',
        },
    },
    images: {
        toolkit: {
            src: ['src/assets/toolkit/images/*', 'src/favicon.ico'],
            dest: 'dist/assets/toolkit/images',
            watch: 'src/assets/toolkit/images/**/*',
        },
    },
    fonts: {
        indico: {
            src: ['indico/indico/htdocs/static/fonts/**/*'],
            dest: 'dist/assets/toolkit/static/fonts',
            watch: 'indico/indico/htdocs/static/fonts/**/*',
        },
    },
    templates: {
        watch: 'src/**/*.{html,md,json,yml}',
    },
    dest: 'dist',
};

function reworkCSSUrls(style) {
    style.rules.forEach(function(rule) {
        if (!rule.declarations) {
            return;
        }
        rule.declarations.filter(function(decl) {
            if (!decl.value) {
                return;
            }
            return ~decl.value.indexOf('url(');
        }).forEach(function(decl) {
            decl.value = decl.value.replace(/\/static\//g, STATIC_BASE);
        });
    });
}

// clean
gulp.task('clean', del.bind(null, [config.dest]));


// styles
gulp.task('styles:fabricator', () => {
    gulp.src(config.styles.fabricator.src)
        .pipe(sourcemaps.init())
        .pipe(sass().on('error', sass.logError))
        .pipe(prefix('last 1 version'))
        .pipe(gulpif(!config.dev, csso()))
        .pipe(rename('f.css'))
        .pipe(sourcemaps.write())
        .pipe(gulp.dest(config.styles.fabricator.dest))
        .pipe(gulpif(config.dev, reload({ stream: true })));
});

gulp.task('styles:toolkit', () => {
    gulp.src(config.styles.toolkit.src)
        .pipe(gulpif(config.dev, sourcemaps.init()))
        .pipe(sass({
            includePaths: [
                './node_modules',
                './indico/indico/htdocs/sass/lib/compass',
                './indico/indico/htdocs/sass'],
            importer: importOnce,
        }).on('error', sass.logError))
        .pipe(rework(reworkCSSUrls))
        .pipe(prefix('last 1 version'))
        .pipe(gulpif(!config.dev, csso()))
        .pipe(gulpif(config.dev, sourcemaps.write()))
        .pipe(gulp.dest(config.styles.toolkit.dest))
        .pipe(gulpif(config.dev, reload({ stream: true })));
});

gulp.task('styles', ['styles:fabricator', 'styles:toolkit']);


// scripts
const webpackConfig = require('./webpack.config')(config);

gulp.task('scripts', (done) => {
    webpack(webpackConfig, (err, stats) => {
        if (err) {
            gutil.log(gutil.colors.red(err()));
        }
        const result = stats.toJson();
        if (result.errors.length) {
            result.errors.forEach((error) => {
                gutil.log(gutil.colors.red(error));
            });
        }
        done();
    });
});


// images
gulp.task('images', ['favicon'], () => {
    return gulp.src(config.images.toolkit.src)
        .pipe(imagemin())
        .pipe(gulp.dest(config.images.toolkit.dest));
});

gulp.task('favicon', () => {
    return gulp.src('src/favicon.ico')
        .pipe(gulp.dest(config.dest));
});

// fonts
gulp.task('fonts', () => {
    return gulp.src(config.fonts.indico.src)
        .pipe(gulp.dest(config.fonts.indico.dest));
});

// assembler
gulp.task('assembler', (done) => {
    assembler({
        logErrors: config.dev,
        dest: config.dest,
    });
    done();
});


// server
gulp.task('serve', () => {

    browserSync({
        server: {
            baseDir: config.dest,
        },
        notify: false,
        logPrefix: 'FABRICATOR',
    });

    gulp.task('assembler:watch', ['assembler'], browserSync.reload);
    gulp.watch(config.templates.watch, ['assembler:watch']);

    gulp.task('styles:watch', ['styles']);
    gulp.watch([config.styles.fabricator.watch, config.styles.toolkit.watch], ['styles:watch']);

    gulp.task('scripts:watch', ['scripts'], browserSync.reload);
    gulp.watch([config.scripts.fabricator.watch, config.scripts.toolkit.watch], ['scripts:watch']);

    gulp.task('images:watch', ['images'], browserSync.reload);
    gulp.watch(config.images.toolkit.watch, ['images:watch']);

    gulp.task('fonts:watch', ['fonts'], browserSync.reload);
    gulp.watch(config.fonts.indico.watch, ['fonts:watch']);

});


// default build task
gulp.task('default', ['clean'], () => {

  // define build tasks
    const tasks = [
        'styles',
        'scripts',
        'images',
        'fonts',
        'assembler',
    ];

  // run build
    runSequence(tasks, () => {
        if (config.dev) {
            gulp.start('serve');
        }
    });

});

/**
 * Push build to gh-pages
 */
gulp.task('deploy', () => {
    return gulp.src("./dist/**/*")
        .pipe(deploy());
});
