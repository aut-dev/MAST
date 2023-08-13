<?php

namespace Plugins\Tasks;

use Plugins\Tasks\behaviors\DailyTaskBehavior;
use Plugins\Tasks\behaviors\TaskBehavior;
use Plugins\Tasks\behaviors\UserBehavior;
use Plugins\Tasks\services\TasksService;
use Plugins\Tasks\twig\TasksExtension;
use craft\base\Plugin;
use craft\elements\Entry;
use craft\elements\User;
use craft\helpers\DateTimeHelper;
use craft\helpers\ElementHelper;
use craft\services\Elements;
use yii\base\Event;

class Tasks extends Plugin
{
    public static $plugin;

    public string $schemaVersion = '1.0.1';

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
        $this->registerTwig();
    }

    public static function getAdminEmails(): array
    {
        return explode(',', getenv('ADMIN_EMAILS'));
    }

    protected function registerTwig()
    {
        if (\Craft::$app->request->getIsSiteRequest()) {
            \Craft::$app->view->registerTwigExtension(new TasksExtension());
        }
    }

    protected function registerTasksEvents()
    {
        Event::on(Elements::class, Elements::EVENT_AFTER_SAVE_ELEMENT, function (Event $event) {
            $entry = $event->element;
            if ($entry instanceof Entry and !ElementHelper::isDraftOrRevision($entry) and $entry->section->handle == 'task') {
                Tasks::$plugin->tasks->afterSavingTask($entry, $event->isNew);
            }
        });
        Event::on(Elements::class, Elements::EVENT_BEFORE_SAVE_ELEMENT, function (Event $event) {
            $entry = $event->element;
            if ($entry instanceof Entry and !ElementHelper::isDraftOrRevision($entry) and $entry->section->handle == 'task') {
                Tasks::$plugin->tasks->beforeSavingTask($entry, $event->isNew);
            }
        });
        Event::on(Elements::class, Elements::EVENT_BEFORE_DELETE_ELEMENT, function (Event $event) {
            $entry = $event->element;
            if ($entry instanceof Entry and !ElementHelper::isDraftOrRevision($entry) and $entry->section->handle == 'task') {
                Tasks::$plugin->tasks->beforeDeletingTask($entry, $event->hardDelete);
            }
        });
    }

    protected function registerComponents()
    {
        $this->setComponents([
            'tasks' => TasksService::class
        ]);
    }

    protected function registerBehaviors()
    {
        Event::on(Entry::class, Entry::EVENT_DEFINE_BEHAVIORS, function (Event $event) {
            if ($event->sender->sectionId) {
                if ($event->sender->section->handle == 'task') {
                    $event->sender->attachBehavior('plugin-tasks', TaskBehavior::class);
                }
                if ($event->sender->section->handle == 'dailyTask') {
                    $event->sender->attachBehavior('plugin-tasks', DailyTaskBehavior::class);
                }
            }
        });
        Event::on(User::class, User::EVENT_DEFINE_BEHAVIORS, function (Event $event) {
            $event->sender->attachBehavior('plugin-tasks', UserBehavior::class);
        });
    }
}
