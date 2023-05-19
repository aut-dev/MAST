<?php

namespace Plugins\Tasks;

use Plugins\Tasks\behaviors\BlockBehavior;
use Plugins\Tasks\behaviors\UserBehavior;
use Plugins\Tasks\services\TasksService;
use craft\base\Plugin;
use craft\elements\Entry;
use craft\elements\User;
use yii\base\Event;

class Tasks extends Plugin
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

    /**
     * Register plugins components
     */
    protected function registerComponents()
    {
        $this->setComponents([
            'tasks' => TasksService::class
        ]);
    }

    protected function registerBehaviors()
    {
        Event::on(User::class, User::EVENT_DEFINE_BEHAVIORS, function (Event $event) {
            $event->sender->attachBehavior('plugin-tasks', UserBehavior::class);
        });
        Event::on(Entry::class, Entry::EVENT_DEFINE_BEHAVIORS, function (Event $event) {
            if ($event->sender->sectionId) {
                if ($event->sender->section->handle == 'taskBlock') {
                    $event->sender->attachBehavior('plugin-tasks', BlockBehavior::class);
                }
            }
        });
    }
}
