<?php

namespace Plugins\Timesheets\behaviors;

use Plugins\Timesheets\Timesheets;
use yii\base\Behavior;
use DateInterval;
use DateTime;

class TaskBehavior extends Behavior
{
    public $owner;

    /**
     * Get the time (in seconds) recorded in timesheets for any given day, defaults to today if null
     * Will return time logged since the deadline the day before
     *
     * @return int
     */
    public function getTimesheetSpent(DateTime $day): int
    {
        if ($day === null) {
            $day = $this->owner->author->today;
        }
        $day = clone $day;
        $day->setTime($this->owner->deadline->format('H'), $this->owner->deadline->format('i'), 59);
        $yesterday = clone $day;
        $yesterday->sub(new DateInterval('P1D'));
        $day->setTime(23, 59, 59);
        return Timesheets::$plugin->timesheets->getTimeRecorded($this->owner, $yesterday, $day);
    }

    /**
     * Get the time (in seconds) recorded in timesheets for any given day, defaults to today if null
     * Will return time logged since the deadline the day before until the day's deadline
     *
     * @return int
     */
    public function getTimesheetSpentUntilDeadline(DateTime $day): int
    {
        if ($day === null) {
            $day = $this->owner->author->today;
        }
        $day = clone $day;
        $day->setTime($this->owner->deadline->format('H'), $this->owner->deadline->format('i'), 59);
        $yesterday = clone $day;
        $yesterday->sub(new DateInterval('P1D'));
        return Timesheets::$plugin->timesheets->getTimeRecorded($this->owner, $yesterday, $day);
    }
}
