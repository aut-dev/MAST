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
    }

    protected function registerComponents()
    {
        $this->setComponents([
            'timesheets' => TimesheetsService::class,
        ]);
    }

    protected function registerBehaviors()
    {
        Event::on(Entry::class, Entry::EVENT_DEFINE_BEHAVIORS, function (Event $event) {
            if ($event->sender->sectionId) {
                if ($event->sender->section->handle == 'scheduledTask') {
                    $event->sender->attachBehavior('plugin-timesheets', TaskBehavior::class);
                }
            }
        });
    }

    protected function registerEvents()
    {
        Event::on(Elements::class, Elements::EVENT_AFTER_SAVE_ELEMENT, function (Event $event) {
            $element = $event->element;
            if (!ElementHelper::isDraftOrRevision($element) and $element instanceof Entry and $element->section->handle == 'timesheet') {
                Timesheets::$plugin->timesheets->onTimesheetChange($element);
            }
        });
        Event::on(Elements::class, Elements::EVENT_AFTER_DELETE_ELEMENT, function (Event $event) {
            $element = $event->element;
            if (!ElementHelper::isDraftOrRevision($element) and $element instanceof Entry and $element->section->handle == 'timesheet') {
                Timesheets::$plugin->timesheets->onTimesheetChange($element);
            }
        });
    }
}
