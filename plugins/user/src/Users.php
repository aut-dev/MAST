<?php

namespace Plugins\Users;

use Plugins\Users\behaviors\UserBehavior;
use Plugins\Users\services\UsersService;
use craft\base\Plugin;
use craft\elements\User;
use craft\services\Elements;
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
        if (\Craft::$app->request->isSiteRequest) {
            //Save user id in session after sign up
            Event::on(Elements::class, Elements::EVENT_AFTER_SAVE_ELEMENT, function (Event $event) {
                $user = $event->element;
                $path = \Craft::$app->request->getPathInfo();
                if ($user instanceof User and $path == 'sign-up') {
                    \Craft::$app->session->set('membership-user-id', $user->id);
                }
            });
        }
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
