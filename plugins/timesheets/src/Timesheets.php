<?php

namespace Plugins\Timesheets;

use Plugins\Timesheets\behaviors\TaskBehavior;
use Plugins\Timesheets\behaviors\TimesheetBehavior;
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
        $this->registerTimesheetsEvents();
    }

    protected function registerComponents()
    {
        $this->setComponents([
            'timesheets' => TimesheetsService::class,
        ]);
    }

    protected function registerTimesheetsEvents()
    {
        Event::on(Entry::class, Entry::EVENT_AFTER_VALIDATE, function (Event $event) {
            $entry = $event->sender;
            if (!ElementHelper::isDraftOrRevision($entry) and $entry->section->handle == 'timesheet') {
                Timesheets::$plugin->timesheets->validateTimesheet($entry);
            }
        });

        if (\Craft::$app->request->isSiteRequest and \Craft::$app->request->isActionRequest) {
            $action = implode('/', \Craft::$app->request->getActionSegments() ?? []);
            if ($action == 'entries/save-entry') {
                Event::on(Elements::class, Elements::EVENT_AFTER_SAVE_ELEMENT, function (Event $event) {
                    $sheet  =$event->element;
                    if ($sheet instanceof Entry and !ElementHelper::isDraftOrRevision($sheet) and $sheet->section->handle == 'timesheet') {
                        $sheet = $event->element;
                        \Craft::$app->session->setNotice(\Craft::t('site', 'Time entry saved'));
                    }
                });
            }
        }
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
                if ($event->sender->section->handle == 'timesheet') {
                    $event->sender->attachBehavior('plugin-timesheets', TimesheetBehavior::class);
                }
            }
        });
    }

    protected function registerEvents()
    {
    }
}
