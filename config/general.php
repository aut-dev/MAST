<?php
/**
 * General Configuration
 *
 * All of your system's general configuration settings go in here. You can see a
 * list of the available settings in vendor/craftcms/cms/src/config/GeneralConfig.php.
 *
 * @see \craft\config\GeneralConfig
 */

use craft\config\GeneralConfig;
use craft\helpers\App;

$isDev = App::env('CRAFT_ENVIRONMENT') === 'dev';
$isProd = App::env('CRAFT_ENVIRONMENT') === 'production';
$isLocal = App::env('CRAFT_ENVIRONMENT') === 'local';

return GeneralConfig::create()
    // Set the default week start day for date pickers (0 = Sunday, 1 = Monday, etc.)
    ->defaultWeekStartDay(1)
    // Prevent generated URLs from including "index.php"
    ->omitScriptNameInUrls()
    // Enable Dev Mode on the dev/local environment (see https://craftcms.com/guides/what-dev-mode-does)
    ->devMode(!$isProd)
    // Only allow administrative changes on the local/production environment
    ->allowAdminChanges(!$isDev)
    // Disallow robots everywhere except the production environment
    ->disallowRobots(!$isProd)
    //Enable template caching on production
    ->enableTemplateCaching($isProd)
    //Disable all updates on production
    ->allowUpdates(!$isProd)
    //Set control panel trigger
    ->cpTrigger('admin_H2LQ93BD')
    //Set same site cookie value
    ->sameSiteCookieValue('Lax')
    //Generate transforms
    ->generateTransformsBeforePageLoad(true)
    //Set the web alias
    ->aliases([
        '@web' => App::env('PRIMARY_SITE_URL'),
    ])
    //Do not transform gifs
    ->transformGifs(false)
    //Keep session when user agents don't match
    ->requireMatchingUserAgentForSession(false)
    //Keep only two backups
    ->maxBackups(2)
    //Keep only 10 revisions
    ->maxRevisions(10)
    //One week duration verification code
    ->verificationCodeDuration(604800)
;
