<?php

namespace Plugins\Agent;

use Plugins\Agent\services\AgentService;
use Plugins\Agent\services\TokenService;
use craft\base\Plugin;
use craft\console\Application as ConsoleApplication;
use craft\web\UrlManager;
use yii\base\Event;

class Agent extends Plugin
{
    public static $plugin;

    public function init()
    {
        parent::init();
        self::$plugin = $this;

        $this->registerComponents();
        $this->registerRoutes();

        if (\Craft::$app instanceof ConsoleApplication) {
            $this->controllerNamespace = 'Plugins\\Agent\\console\\controllers';
        }
    }

    protected function registerRoutes()
    {
        Event::on(UrlManager::class, UrlManager::EVENT_REGISTER_SITE_URL_RULES, function (Event $event) {
            $event->rules = array_merge($event->rules, [
                'api/agent/commit' => 'plugin-agent/api/commit',
                'api/agent/complete' => 'plugin-agent/api/complete',
                'api/agent/status' => 'plugin-agent/api/status',
                'api/agent/me' => 'plugin-agent/api/me',
            ]);
        });
    }

    protected function registerComponents()
    {
        $this->setComponents([
            'agent' => AgentService::class,
            'token' => TokenService::class,
        ]);
    }
}
