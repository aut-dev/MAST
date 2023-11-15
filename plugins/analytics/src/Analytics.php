<?php

namespace Plugins\Analytics;

use Plugins\Analytics\services\AnalyticsService;
use Plugins\Analytics\variables\AnalyticsVariable;
use craft\base\Plugin;
use craft\web\twig\variables\CraftVariable;
use yii\base\Event;

class Analytics extends Plugin
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
        $this->registerVariables();
    }

    /**
     * Registers twig variables
     */
    protected function registerVariables()
    {
        Event::on(CraftVariable::class, CraftVariable::EVENT_INIT, function (Event $event) {
            $variable = $event->sender;
            $variable->set('analytics', AnalyticsVariable::class);
        });
    }

    protected function registerComponents()
    {
        $this->setComponents([
            'analytics' => AnalyticsService::class
        ]);
    }
}
