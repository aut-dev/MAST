<?php

namespace Plugins\Timesheets\behaviors;

use Plugins\Timesheets\Timesheets;
use yii\base\Behavior;

class TaskBehavior extends Behavior
{
    public $owner;

    /**
     * Get the time (in seconds) recorded in timesheets since last deadline
     *
     * @return int
     */
    public function getTimesheetSpentSinceLastDeadline(): int
    {
        return Timesheets::$plugin->timesheets->getTimeRecorded($this->owner, $this->owner->yesterdayDeadline, $this->owner->todayDeadline);
    }
}
