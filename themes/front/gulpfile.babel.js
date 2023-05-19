import gulp     from 'gulp';
import plugins  from 'gulp-load-plugins';
import browser  from 'browser-sync';
import rimraf   from 'rimraf';
import panini   from 'panini';
import yargs    from 'yargs';
import lazypipe from 'lazypipe';
import inky     from 'inky';
import fs       from 'fs';
import siphon   from 'siphon-media-query';
import path     from 'path';
import merge    from 'merge-stream';
import beep     from 'beepbeep';
import colors   from 'colors';
import replace  from 'gulp-replace';
import tap      from 'gulp-tap';
import replaceImgSrc from 'gulp-replace-image-src';
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const $ = plugins();

// Look for the --production flag
const PRODUCTION = !!(yargs.argv.production);
const EMAIL = yargs.argv.to;

const publicFolder = path.resolve(__dirname, '../../web/themes/front/email');
const prependImgUrl = PRODUCTION ? '{{ siteUrl }}themes/front/email/' : process.env.PRIMARY_SITE_URL+'/themes/front/email/';

// Declar var so that both AWS and Litmus task can use it.
var CONFIG;

// Build the "dist" folder by running all of the below tasks
gulp.task('build',
  gulp.series(clean, pages, sass, images, inline));

// Build emails, run the server, and watch for file changes
gulp.task('default',
  gulp.series('build', server, watch));

// Delete the "dist" folder
// This happens every time a build starts
function clean(done) {
  rimraf('templates/emails/dist', done);
}

// Compile layouts, pages, and partials into flat HTML files
// Then parse using Inky templates
function pages() {
  return gulp.src(['templates/emails/src/pages/**/*.html', '!templates/emails/src/pages/archive/**/*.html'])
    .pipe(panini({
      root: 'templates/emails/src/pages',
      layouts: 'templates/emails/src/layouts',
      partials: 'templates/emails/src/partials',
      helpers: 'templates/emails/src/helpers'
    }))
    .pipe(inky())
    .pipe(replaceImgSrc({
      prependSrc: prependImgUrl
    }))
    .pipe($.if(!PRODUCTION, $.replace('{{ siteUrl }}', process.env.PRIMARY_SITE_URL)))
    .pipe(gulp.dest('templates/emails/dist'));
}

// Reset Panini's cache of layouts and partials
function resetPages(done) {
  panini.refresh();
  done();
}

// Compile Sass into CSS
function sass() {
  return gulp.src('src/css/emails/*.scss')
    .pipe($.if(!PRODUCTION, $.sourcemaps.init()))
    .pipe($.sass({
      includePaths: ['node_modules/foundation-emails/scss']
    }).on('error', $.sass.logError))
    .pipe($.if(PRODUCTION, $.uncss(
      {
        html: ['templates/emails/dist/**/*.html']
      })))
    .pipe($.if(!PRODUCTION, $.sourcemaps.write()))
    .pipe(gulp.dest('templates/emails/dist/css'));
}

// Copy and compress images
function images() {
  return gulp.src(['templates/emails/src/assets/img/**/*', '!templates/emails/src/assets/img/archive/**/*'])
    .pipe($.imagemin())
    .pipe(gulp.dest(publicFolder));
}

// Inline CSS and minify HTML
// function inline() {
//   return gulp.src('templates/emails/dist/**/*.html')
//     .pipe($.if(PRODUCTION, inliner()))
//     .pipe(gulp.dest('templates/emails/dist'));
// }

function inline() {
  return gulp.src('templates/emails/dist/**/*.html')
    .pipe(tap(function(file, t) {
        if (PRODUCTION) {
          inliner(file.path);
        }
    }))
    .pipe(gulp.dest('templates/emails/dist'));
}

// Start a server with LiveReload to preview the site in
function server(done) {
  browser.init({
    server: 'templates/emails/dist'
  });
  done();
}

// Watch for file changes
function watch() {
  gulp.watch('templates/emails/src/**/*.html').on('all', gulp.series(resetPages, pages, inline, browser.reload));
  gulp.watch(['templates/emails/src/layouts/**/*', 'src/partials/**/*']).on('all', gulp.series(resetPages, pages, inline, browser.reload));
  gulp.watch(['src/css/emails/**/*.scss', 'src/assets/scss/**/*.scss']).on('all', gulp.series(resetPages, sass, pages, inline, browser.reload));
  gulp.watch('templates/emails/src/assets/img/**/*').on('all', gulp.series(images, browser.reload));
}

// Inlines CSS into HTML, adds media query CSS into the <style> tag of the email, and compresses the HTML
function inliner(file) {
  console.log(file);
  var html = fs.readFileSync(file).toString();
  var match = html.match(/href="(css\/[\w]+\.css)"/);
  if (!match) {
    return;
  }
  var css = fs.readFileSync('templates/emails/dist/'+match[1]).toString();
  var mqCss = siphon(css);

  var pipe = lazypipe()
    .pipe($.inlineCss, {
      applyStyleTags: false,
      removeStyleTags: true,
      preserveMediaQueries: true,
      removeLinkTags: false
    })
    .pipe($.replace, '<!-- <style> -->', `<style>${mqCss}</style>`)
    .pipe($.replace, '<link rel="stylesheet" type="text/css" href="css/app.css">', '');

  return pipe();
}
