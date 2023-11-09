<?php

namespace Plugins\Analytics;

use Plugins\Analytics\services\AnalyticsService;
use craft\base\Plugin;

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
    }

    protected function registerComponents()
    {
        $this->setComponents([
            'analytics' => AnalyticsService::class
        ]);
    }
}
