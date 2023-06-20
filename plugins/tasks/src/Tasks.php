<?php

namespace Plugins\Tasks;

use Plugins\Tasks\behaviors\TaskBehavior;
use Plugins\Tasks\services\TasksService;
use Plugins\Tasks\services\UsersService;
use craft\base\Plugin;
use craft\elements\Entry;
use craft\elements\User;
use craft\helpers\DateTimeHelper;
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
        Event::on(Entry::class, Entry::EVENT_DEFINE_BEHAVIORS, function (Event $event) {
            if ($event->sender->sectionId) {
                if ($event->sender->section->handle == 'task') {
                    $event->sender->attachBehavior('plugin-tasks', TaskBehavior::class);
                }
            }
        });
    }
}
