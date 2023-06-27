<?php

namespace Plugins\Tasks\behaviors;

use DateTime;
use Plugins\Tasks\Tasks;
use craft\helpers\DateTimeHelper;
use yii\base\Behavior;
use DateInterval;

class TaskBehavior extends Behavior
{
    public $owner;
    protected $_todayDuration;
    protected $_spent;

    /**
     * Get the time spent in seconds since last deadline. Includes timesheets + timer (if started)
     *
     * @return int
     */
    public function getTimeSpent(): int
    {
        if ($this->_spent === null) {
            $timer = $this->owner->author->getTimerSpent($this->owner);
            $sheets = $this->owner->getTimesheetSpentSinceLastDeadline();
            $this->_spent = $timer + $sheets;
        }
        return $this->_spent;
    }

    /**
     * Is a task complete
     *
     * @return bool
     */
    public function getIsComplete(): bool
    {
        if (!$this->getIsActiveToday() or $this->getIsExpired()) {
            return false;
        }
        if ($this->owner->taskType->value == 'more') {
            return $this->getTimeSpent() >= $this->getTodayDuration();
        }
        return $this->getTimeSpent() <= $this->getTodayDuration();
    }

    /**
     * Is a task derailed
     *
     * @return bool
     */
    public function getIsDerailed(): bool
    {
        if (!$this->getIsActiveToday()) {
            return false;
        }
        if ($this->owner->taskType->value == 'more' and !$this->getIsExpired()) {
            return false;
        }
        if ($this->owner->taskType->value == 'more') {
            return $this->getTimeSpent() < $this->getTodayDuration();
        }
        return $this->getTimeSpent() > $this->getTodayDuration();
    }

    /**
     * Is this task expired
     *
     * @return bool
     */
    public function getIsExpired(): bool
    {
        return $this->getIsActiveToday() and $this->getTodayDeadline() < DateTimeHelper::toDateTime('now');
    }

    /**
     * Is this task active today
     *
     * @return bool
     */
    public function getIsActiveToday(): bool
    {
        return $this->getTodayDuration() > 0;
    }

    /**
     * Get today's deadline
     *
     * @return DateTime
     */
    public function getTodayDeadline(): DateTime
    {
        return (clone $this->owner->author->today)->setTime($this->owner->deadline->format('H'), $this->owner->deadline->format('i'), 0);
    }

    /**
     * Get yesterday's deadline
     *
     * @return DateTime
     */
    public function getYesterdayDeadline(): DateTime
    {
        return (clone $this->getTodayDeadline())->sub(new DateInterval('P1D'));
    }

    /**
     * Get the next deadline
     *
     * @return DateTime
     */
    public function getNextDeadline(): DateTime
    {
        $today = $this->owner->author->today;
        $duration = 0;
        while ($duration == 0) {
            $today->add(new DateInterval('P1D'));
            $duration = $this->getDuration($today);
        }
        return $today->setTime($this->owner->deadline->format('H'), $this->owner->deadline->format('i'), 0);
    }

    /**
     * Get the duration in seconds for today
     *
     * @return int
     */
    public function getTodayDuration(): int
    {
        if ($this->_todayDuration === null) {
            $this->_todayDuration = $this->getDuration($this->owner->author->today);
        }
        return $this->_todayDuration;
    }

    /**
     * Set a date to the beginning of the week
     *
     * @param  DateTime $date
     */
    protected function beginningOfWeek(DateTime $date)
    {
        while ($date->format('D') != 'Mon') {
            $date->sub(new DateInterval('P1D'));
        }
        return $date;
    }

    /**
     * Get the time duration for any given day
     *
     * @param  DateTime $day
     * @return float
     */
    protected function getDuration(DateTime $day): float
    {
        $startDate = (clone $this->owner->startDate)->setTime(0, 0, 0);
        if ($startDate <= $day) {
            $thisWeek = $this->beginningOfWeek(clone $day);
            $start = $this->beginningOfWeek($startDate);
            $current = 0;
            $weeks = $this->owner->weeks instanceof Collection ? $this->owner->weeks : $this->owner->weeks->all();
            $max = sizeof($weeks);
            while ($start < $thisWeek) {
                $current++;
                if ($current >= $max) {
                    $current = 0;
                }
                $start->add(new DateInterval('P7D'));
            }
            $week = $weeks[$current];
            $day = strtolower($day->format('D'));
            $length = $week[$day];
            return $length * $this->owner->length;
        }
        return 0;
    }
}
