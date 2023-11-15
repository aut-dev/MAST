<?php

namespace Plugins\Analytics\variables;

use Plugins\Analytics\Analytics;
use craft\elements\User;

class AnalyticsVariable
{
    public function getMetrics(User $user)
    {
        return Analytics::$plugin->analytics->getMetrics($user);
    }
}
