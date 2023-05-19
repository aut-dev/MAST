# Craft base project

This repo is hooked on https://craft.puzzlers.run/ please don't push any changes specific to a website to it.

To create a new project from it, use the following command: `composer create-project puzzlers/craft:dev-master`  

# Installation

## Composer config (do only once per computer)

This project use composer version 2

Update your global composer config by running the commands :

- `composer2 config -g repositories.puzzlers-craft composer https://gitlab.puzzlers.run/api/v4/group/7/-/packages/composer/`
- `composer2 config -g gitlab-token.gitlab.puzzlers.run <TOKEN>`
- `composer2 config -g gitlab-domains gitlab.puzzlers.run`

\<TOKEN> is your gitlab token, found on gitlab, user settings -> Access tokens -> Tick "api" scopes and create -> copy paste

That will tell composer where to look for the craft package that live on gitlab, and take care of all authentication.

# Environement

the .env contains all variables that depend on the environment.
the ENVIRONMENT can be `local`, `dev`, `staging` or `production`

This file is git ignored, so if you make a change in it that you need to be populated on dev/live, you'll need to change the file on the server directly.

The ENVIRONMENT variable controls a few things (see `config/general.php`), mainly :
- The behaviour when a exception happens. Shows the error on non-production, shows the 500 page on production (variable `devMode`)
- Disable config changes on dev/production (depending, see below)
- template caching : enabled on production

# Debug

## In code

You can use the symfony dumper : `dump($data)` or `dd($data)`
Or the craft dumper : `cdump($data)` or `cdd($data)`

## In twig

`{{ d() }}` to output a Kint bar displaying all the defined variables. the bar appears at the bottom of the page.
or
`{{ d(variable) }}`

## Debug bar

A very powerful debug tool, it needs to be enabled in your profile in the back end, Top right hand side -> click on the user -> Preferences -> Show debug bar

# Front end

Craft doesn't come with any front end. We do so by creating a theme for the front end and select it in the back end settings.

## Themes

A theme is a collection of templates and assets. Themes can extend each other, so if a plugin A extends a plugin B, all templates called in plugin A that do not exist in A but exist in B will be loaded.

Good practices when coding templates :
- re-use templates : templates can reuse each other
- use caching when possible : see docs
- use blocks for templates that are meant to be reused
- lots of variables are available to you in a twig template, {{ d() }} to see them all in kint
- **Never output a original image** always use either
  - an image transformation : https://craftcms.com/docs/3.x/image-transforms.html. This is ok for small images that don't change much.
  - Even better, use imager (see links below), to resize the images automatically and output a srcset lazyloaded image. This takes care of responsive as well. This should be used as often as you can, there are big advantages that will make a difference in site speed.

This comes with a base theme by default, from which all theme you extend. the base theme is hosted on gitlab : https://gitlab.puzzlers.run/craft-plugins/base-theme
You can update that base plugin to add functionnality to every future craft site.

## Prefetching

A plugin allows you to prefetch anything you want in your templates, see doc there : https://github.com/ryssbowh/craft-prefetch

### Images

Use the helper at `themes/front/templates/_helpers/images` for a useful macro, it can output an image that is responsive, display a placeholder if your image is missing and display a webp image if the browser supports it. Webp images are up to 40-50% lighter and support transparency.

In order to output a image in webp, use the helper, if the browser doesn't support wepb it will fall back to a normal image. It's all automatic if you use the helper.

The "responsive" is handled with the img argument "srcset" and a small JS library, lazysizes which will lazy load the images according to the size of the screen.

Here are a few examples :

- Responsive image with 3 sizes, different ratios for different screens
```
{{ images.responsiveImg(image, [
    { width: 1400, ratio: 3/1 },
    { width: 1024, ratio: 3/1 },
    { width: 768, ratio: 2/1 },
    ]) 
}}
```
- Single image
```
{{ images.singleImg(image, 500) }}
```

Those 2 commands have more options to control quality, sizes etc

## Webpack

We use webpack to build the themes assets, everything is automatised so you only have to run the commands :
- `cd themes/front`
- Install npm : `npm i`, you will need node version >= 10 for this to work.
- `npm run dev` to build the assets js/css (development mode)
- `npm run watch` to build the assets and keep building as you make changes (development mode)
- `npm run prod` to build the assets for production environments
- `npm run watch-prod` to build the assets and keep building as you make changes (production mode). This can be slow

Here's how it works roughly :

webpack looks at you entry file : `theme/front/src/app.js` this is where you import all the other files, your source files, as well as external modules, installed with npm. In this file goes js **and** scss.

The `theme/front/src/css/resources.scss` is used to declare variables. If you need to change bootstrap variables (colors, margins, breakpoints etc), or any npm modules variables, you can do it there. The variables defined there will be available everywhere in your scss. Do not add normal scss/css in there or it will be duplicated several times.
Example for bootstrap, you can re-define any variable defined in `themes/front/node_modules/bootstrap/scss/_variables.scss`

webpack then build the files in the `web/themes/front` folder. for each js file, there is 1 vendor file and one app file. For each css file there is one vendor and one app file, and some extra css files for desktop, tablet and mobile. Webpack automatically looks at css media queries and separate them into different files.

In the vendor files goes everything that is imported through npm. The app files is your code, the css/js you've written. This is interesting as when you're doing changes to your app, the vendor css/js will stay the same (unless you add new libraries), and the users won't have to re-download it.

All files names have a hash in them, every time the content changes, the hash changes, that will clear the cache on user's browsers automatically.

The files are then mapped in the manifest.json, which is read by your theme (using the module twigpack) to inject the files in the html.

Webpack will also automatically extract the images/fonts declared anywhere in the scss and put them in the public folder as well, that's why you see a node_module folder in the public folder, that's all the images/fonts/files of the npm modules.

Webpack will optimise all the images as well, reducing their size. For tiny images (smaller than 10kb), it will encode them into base64, so the users don't have to download them.

## Images/Fonts

In order to extract your images or fonts into the public folder, you only need to create a `AssetBundle`, see `themes/front/assets/Images.php`, and declare this asset in the `getBundleAssets()` method of your `Theme.php`

When you need to import them in a scss file you'd just do : `url(fonts/example.woff)` (relative to the file you write this into) and webpack will extract it.  
When you need to import them in a template, use the `theme_url` function : `<img src="{{ theme_url("@theme/images/craft.jpg")}}"/>`

## WYSIWYG

The default rich text editor in Craft is Redactor. It works in 2 parts :

- Redactor itself, allow plugins and options for the editor. Config profiles in config/redactor.
You can enable different profiles when creating your fields.
- Purifier : This cleans the html once you submit an entry. It blocks a lot of things to prevent users from copy pasting. config in config/htmlpurifier.
The default config allows any iframe from google for example.

If something is blocked in your content and comes up as blank, it's been filtered out, you need to allow it using purifier config.

Different purifier profiles can be chosen for a field, in the advanced tab at the bottom.

## Emails

All the emails templates are built with a tool mostly based on [Foundation](https://get.foundation/emails.html). Foundation has a very simple syntax to build emails and makes sure the email will look the same in every email client.

You would write the cms template in the `themes/front/templates/emails/src/pages` using the foundation syntax, [Inky](https://get.foundation/emails/docs/inky.html), then run the builder that will build them into `themes/front/templates/emails/dist`. You can then use those in your php code, example :
```
$html = \Craft::$app->view->renderTemplate('@root/themes/front/templates/emails/dist/example', $variables);
$email = \Craft::$app
    ->getMailer()
    ->compose()
    ->setFrom($sentFrom)
    ->setTo($emails)
    ->setSubject($subject)
    ->setHtmlBody($html);
$email->send();
```

To run the builder (make sure you have installed npm before) :

- local mode : `npm run watch-emails`
- production mode `npm run build-emails`

When you run those commands your browser will open and you'll be able to see the emails, and watch the changes as you edit the emails templates or the css.

The production mode will prepend all the img url with {{ siteUrl }}, so you won't be able to preview the images in the browser (but you can see them with the local mode). It will also copy all the css inline in the email, so you **must** run the production command before pushing to dev/live.

You need to escape the twig double quote in email src files : `\{{ variable }}` instead of `{{ variable }}`

To include an image in an email you have to copy it in the `themes/front/templates/emails/src/assets/img/image.jpg` and then reference it in your code : `<img src="image.jpg" alt="my image">`

The default scss for emails is located at : `themes/front/templates/src/css/emails/app.scss`. If you need to change the css for one email only, make a new scss file there, example 'contactUs.scss' and reference it in your email template `css: contactUs`

You can't add images as background in css yet.

# Htaccess

When setting up a dev or live site, you need to change the first lines and put the right domains.

the `web/.htaccess` is git controlled and should stay so.
If you need an extra .htaccess you can add one at the root folder, it will be git ignored.

## Logs

All logs are in storage/logs.

A module is installed to integrate with Sentry, which should only be active on production mode. To activate it, create a project on sentry (https://sentry.io) and add the dsn in the .env file.

## CSP

`web/.htaccess` defines CSP rules for which domains are allowed to pull content on the site, it contains some regular domains (facebook, google etc), but you will probably need to add more there if you add third parties to your site.
Your console will tell you when an external file has been block by CSP.

# Plugins

Plugins are the only way of extending functionnality in Craft, they are similar to Yii modules but are more powerful. We can distinguish 3 types of plugins :
- external (that you can find in the plugin store or on github)
- our gitlab plugins
- local plugins (specific to each website), in the plugins folder.

**Every plugin is managed through composer**, it ensures every environment and every developer work with the same versions of each plugin.

Your plugin can have other php packages dependencies (declared in composer.json), either it's a composer package or another gitlab plugin. For info, you can browse thousands of packages on https://packagist.org/ available for you to install for free through composer.

## Local plugins

The plugins folder contains all the plugins for this application. There's an example there for you.
You will make your plugin there and install it through composer : `composer require plugins/example`. You only need to require it once.

After that the plugin will be available in the back end to install/activate.

You don't need to run composer update for local plugins, it's automatic.

It's a good idea to separate functionnality in more plugins rather than one big plugin, it's easier to understand your application logic. If your plugin is generic/useful enough we can move it from the plugins folder to gitlab and make it available for any site to install.

Good practices for creating a plugin :

- Use .env file for sensitive data or data that will change from one environment to another
- Use services : all the heavy work should be in services classes.
- Controllers : read and control input, call service for treatment and return response
- Use settings : Craft makes it really easy to make settings in the back end
- records : classic Yii2, interacts with database
- models : classic Yii2, validation etc
- migrations : This should be the only way to modify database **Please do not modify database manually** it makes things so difficult to manage. After you make a new migration you can change the plugin version in the main class, property `schemaVersion` and craft will understand that there is a migration to make.
- Use the command line utility, lost of useful things there for migrations, plugins etc

## Removing plugins

plugins should be uninstalled from the backend, **then** uninstalled in composer, to make sure the database is cleaned.

# Documentation

- project config : https://craftcms.com/docs/3.x/project-config.html#caveats
- migrations : https://medium.com/@mikethehud/craft-cms-3-content-migration-examples-3a377f6420c3=
- Plugins :
  - https://nystudio107.com/blog/so-you-wanna-make-a-craft-3-plugin
  - https://craftcms.com/docs/3.x/extend/plugin-guide.html#preparation
  - https://pluginfactory.io/
- caching in templates : https://nystudio107.com/blog/the-craft-cache-tag-in-depth
- Foundation emails : https://get.foundation/emails/docs/
- Debug bar : https://nystudio107.com/blog/profiling-your-website-with-craft-cms-3s-debug-toolbar
- Images : https://nystudio107.com/blog/creating-optimized-images-in-craft-cms
- Eager loading : https://nystudio107.com/blog/speed-up-your-craft-cms-templates-with-eager-loading
