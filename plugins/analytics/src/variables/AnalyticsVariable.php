<?php

namespace Plugins\Analytics\variables;

use Plugins\Analytics\Analytics;
use craft\elements\MatrixBlock;
use craft\elements\User;

class AnalyticsVariable
{
    public function getMetrics(User $user)
    {
        return Analytics::$plugin->analytics->getMetrics($user);
    }

    public function getJsonChart(MatrixBlock $chart)
    {
        return Analytics::$plugin->analytics->getJsonChart($chart);
    }
}
