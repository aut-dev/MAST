<?php

namespace Plugins\Tasks\twig;

use Plugins\Tasks\helpers\TimeHelper;
use Twig\Extension\AbstractExtension;
use Twig\TwigFilter;

class TasksExtension extends AbstractExtension
{
    public function getFilters()
    {
        return [
            new TwigFilter('friendlyTimeSpent', [$this, 'friendlyTimeSpentFilter']),
        ];
    }

    public function friendlyTimeSpentFilter(int $seconds): string
    {
        return TimeHelper::friendlySpentTime($seconds);
    }
}
