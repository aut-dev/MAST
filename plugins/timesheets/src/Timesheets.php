<?php

namespace Plugins\Timesheets;

use Plugins\Timesheets\behaviors\BlockBehavior;
use Plugins\Timesheets\services\TimesheetsService;
use craft\base\Plugin;
use craft\elements\Entry;
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
                if ($event->sender->section->handle == 'taskBlock') {
                    $event->sender->attachBehavior('plugin-timesheets', BlockBehavior::class);
                }
            }
        });
    }
}
