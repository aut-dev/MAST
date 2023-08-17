<?php

namespace Plugins\Tasks\twig;

use DateTime;
use Plugins\Tasks\helpers\TimeHelper;
use Twig\Extension\AbstractExtension;
use Twig\TwigFilter;
use craft\elements\Entry;

class TasksExtension extends AbstractExtension
{
    public function getFilters()
    {
        return [
            new TwigFilter('friendlyTimeSpent', [$this, 'friendlyTimeSpentFilter']),
            new TwigFilter('minutesToNow', [$this, 'minutesToNowFilter']),
            new TwigFilter('serializeTask', [$this, 'serializeTask']),
        ];
    }

    public function friendlyTimeSpentFilter(int $seconds): string
    {
        return TimeHelper::friendlySpentTime($seconds);
    }

    public function minutesToNowFilter(DateTime $date): string
    {
        return TimeHelper::minutesToNow($date);
    }
}
