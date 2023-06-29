<?php

namespace Plugins\Stripe;

use Plugins\Stripe\behaviors\UserBehavior;
use Plugins\Stripe\services\StripeService;
use craft\base\Plugin;
use craft\elements\User;
use craft\web\UrlManager;
use yii\base\Event;

class Stripe extends Plugin
{
    /**
     * @var Example
     */
    public static $plugin;

    /**
     * @inheritdoc
     */
    public function init()
    {
        parent::init();
        self::$plugin = $this;

        $this->registerComponents();
        $this->registerBehaviors();
        $this->registerRoutes();
    }

    protected function registerRoutes()
    {
        Event::on(UrlManager::class, UrlManager::EVENT_REGISTER_SITE_URL_RULES, function (Event $event) {
            $event->rules = array_merge($event->rules, [
                'stripe-subscription-success' => 'plugin-stripe/stripe/subscription-success',
                'stripe-subscription-changed' => 'plugin-stripe/webhooks/subscription-changed'
            ]);
        });
    }

    protected function registerComponents()
    {
        $this->setComponents([
            'stripe' => StripeService::class
        ]);
    }

    protected function registerBehaviors()
    {
        Event::on(User::class, User::EVENT_DEFINE_BEHAVIORS, function (Event $event) {
            $event->sender->attachBehavior('plugin-stripe', UserBehavior::class);
        });
    }
}
