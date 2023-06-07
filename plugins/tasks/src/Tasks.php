<?php

namespace Plugins\Tasks;

use Plugins\Tasks\behaviors\TaskBehavior;
use Plugins\Tasks\behaviors\UserBehavior;
use Plugins\Tasks\services\TasksService;
use Plugins\Tasks\services\UsersService;
use craft\base\Plugin;
use craft\elements\Entry;
use craft\elements\User;
use craft\helpers\ElementHelper;
use craft\services\Elements;
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
        $this->registerTasksEvents();
        $this->registerUserEvents();
    }
    public static function getAdminEmails(): array
    {
        return explode(',', getenv('ADMIN_EMAILS'));
    }

    protected function registerTasksEvents()
    {
        Event::on(Elements::class, Elements::EVENT_AFTER_SAVE_ELEMENT, function (Event $event) {
            $task = $event->element;
            if ($task instanceof Entry and !ElementHelper::isDraftOrRevision($task) and $task->section->handle == 'task' and $event->isNew) {
                Tasks::$plugin->tasks->onTaskCreated($task);
            }
        });
        Event::on(Elements::class, Elements::EVENT_BEFORE_SAVE_ELEMENT, function (Event $event) {
            $task = $event->element;
            if ($task instanceof Entry and !ElementHelper::isDraftOrRevision($task) and $task->section->handle == 'task' and !$event->isNew) {
                Tasks::$plugin->tasks->beforeSavingTask($task);
            }
        });
    }

    protected function registerUserEvents()
    {
        Event::on(Elements::class, Elements::EVENT_BEFORE_SAVE_ELEMENT, function (Event $event) {
            $user = $event->element;
            if ($user instanceof User and !ElementHelper::isDraftOrRevision($user) and !$event->isNew) {
                Tasks::$plugin->users->beforeSavingUser($user);
            }
        });
    }

    /**
     * Register plugins components
     */
    protected function registerComponents()
    {
        $this->setComponents([
            'tasks' => TasksService::class,
            'users' => UsersService::class
        ]);
    }

    protected function registerBehaviors()
    {
        Event::on(User::class, User::EVENT_DEFINE_BEHAVIORS, function (Event $event) {
            $event->sender->attachBehavior('plugin-tasks', UserBehavior::class);
        });
        Event::on(Entry::class, Entry::EVENT_DEFINE_BEHAVIORS, function (Event $event) {
            if ($event->sender->sectionId) {
                if ($event->sender->section->handle == 'scheduledTask') {
                    $event->sender->attachBehavior('plugin-tasks', TaskBehavior::class);
                }
            }
        });
    }
}
