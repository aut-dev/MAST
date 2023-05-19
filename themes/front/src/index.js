/**
 * Import here any npm modules and your own js/scss
 * You can import npm modules as css, scss or js
 * By importing scss you give yourself the ability to override the variables through resources.scss
 */

/**************
 * Javascript
 **************/

//App
import 'lazysizes';
import App from './js/app';

window.App = new App;

/**************
 * Css
 **************/

import "bootstrap/scss/bootstrap.scss";

//App
import "./css/app/base/html.scss";
import "./css/app/base/typography.scss";
import "./css/app/components/header.scss";
import "./css/app/components/footer.scss";