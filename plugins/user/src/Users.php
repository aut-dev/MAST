<?php

namespace Plugins\Users;

use Plugins\Users\behaviors\UserBehavior;
use Plugins\Users\services\UsersService;
use craft\base\Plugin;
use craft\elements\User;
use yii\base\Event;

class Users extends Plugin
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
        $this->registerUserEvents();
    }

    protected function registerUserEvents()
    {
        Event::on(User::class, User::EVENT_AFTER_VALIDATE, function (Event $event) {
            Users::$plugin->users->validateUser($event->sender);
        });
    }

    protected function registerComponents()
    {
        $this->setComponents([
            'users' => UsersService::class
        ]);
    }

    protected function registerBehaviors()
    {
        Event::on(User::class, User::EVENT_DEFINE_BEHAVIORS, function (Event $event) {
            $event->sender->attachBehavior('plugin-users', UserBehavior::class);
        });
    }
}
