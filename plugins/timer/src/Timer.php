<?php

namespace Plugins\Timer;

use Plugins\Timer\behaviors\TimerBehavior;
use Plugins\Timer\services\TimerService;
use craft\base\Plugin;
use craft\elements\Entry;
use craft\elements\User;
use craft\services\Elements;
use craft\web\twig\variables\CraftVariable;
use yii\base\Event;

class Timer extends Plugin
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
    }

    protected function registerComponents()
    {
        $this->setComponents([
            'timer' => TimerService::class,
        ]);
    }

    protected function registerBehaviors()
    {
        Event::on(User::class, User::EVENT_DEFINE_BEHAVIORS, function (Event $event) {
            $event->sender->attachBehavior('plugin-timer', TimerBehavior::class);
        });
    }
}
