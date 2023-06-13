<?php

namespace Plugins\Timesheets;

use Plugins\Timesheets\behaviors\TaskBehavior;
use Plugins\Timesheets\services\TimesheetsService;
use craft\base\Plugin;
use craft\elements\Entry;
use craft\helpers\ElementHelper;
use craft\services\Elements;
use yii\base\Event;

class Timesheets extends Plugin
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
        $this->registerEvents();
        $this->registerTasksEvents();
    }

    protected function registerComponents()
    {
        $this->setComponents([
            'timesheets' => TimesheetsService::class,
        ]);
    }

    protected function registerTasksEvents()
    {
        Event::on(Elements::class, Elements::EVENT_BEFORE_DELETE_ELEMENT, function (Event $event) {
            $task = $event->element;
            if ($task instanceof Entry and !ElementHelper::isDraftOrRevision($task) and $task->section->handle == 'task') {
                Timesheets::$plugin->timesheets->deleteForTask($task, $event->hardDelete);
            }
        });
    }

    protected function registerBehaviors()
    {
        Event::on(Entry::class, Entry::EVENT_DEFINE_BEHAVIORS, function (Event $event) {
            if ($event->sender->sectionId) {
                if ($event->sender->section->handle == 'task') {
                    $event->sender->attachBehavior('plugin-timesheets', TaskBehavior::class);
                }
            }
        });
    }

    protected function registerEvents()
    {
    }
}
