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

    public function getGroupBys(): array
    {
        return Analytics::$plugin->analytics->getGroupBys();
    }

    public function getDateRanges(): array
    {
        return Analytics::$plugin->analytics->getDateRanges();
    }

    public function getChartTypes(): array
    {
        return Analytics::$plugin->analytics->getChartTypes();
    }

    public function getChartDataTracked(): array
    {
        return Analytics::$plugin->analytics->getChartDataTracked();
    }
}
