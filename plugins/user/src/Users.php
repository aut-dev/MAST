<?php

namespace Plugins\Users;

use Plugins\Users\behaviors\UserBehavior;
use Plugins\Users\services\UsersService;
use Plugins\Users\services\BreaksService;
use craft\base\Plugin;
use craft\elements\Entry;
use craft\elements\User;
use craft\helpers\ElementHelper;
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
        $this->registerBreakEvents();
    }

    protected function registerBreakEvents()
    {
        Event::on(Entry::class, Entry::EVENT_AFTER_VALIDATE, function (Event $event) {
            $entry = $event->sender;
            if (!ElementHelper::isDraftOrRevision($entry) and $entry->section->handle == 'break') {
                Users::$plugin->breaks->validateBreak($entry);
            }
        });
    }

    protected function registerUserEvents()
    {
        Event::on(User::class, User::EVENT_AFTER_VALIDATE, function (Event $event) {
            Users::$plugin->users->validateUser($event->sender);
        });
        Event::on(Elements::class, Elements::EVENT_BEFORE_SAVE_ELEMENT, function (Event $event) {
            $user = $event->element;
            if ($user instanceof User and !$event->isNew) {
                Users::$plugin->users->beforeSavingUser($user);
            }
        });
    }

    protected function registerComponents()
    {
        $this->setComponents([
            'users' => UsersService::class,
            'breaks' => BreaksService::class
        ]);
    }

    protected function registerBehaviors()
    {
        Event::on(User::class, User::EVENT_DEFINE_BEHAVIORS, function (Event $event) {
            $event->sender->attachBehavior('plugin-users', UserBehavior::class);
        });
    }
}
