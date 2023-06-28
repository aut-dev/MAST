<?php

namespace Plugins\Tasks\behaviors;

use DateInterval;
use DateTime;
use Plugins\Tasks\Tasks;
use Plugins\Tasks\helpers\DateHelper;
use craft\helpers\DateTimeHelper;
use yii\base\Behavior;

class TaskBehavior extends Behavior
{
    public $owner;

    /**
     * Get the time spent in seconds for any given day, defaults to today if null.
     * Includes timesheets + timer (if started and day is today)
     * if $includeAfterDeadline is true it will return all the time recorded after the deadline has passed (until midnight),
     * otherwise will only return until the deadline
     *
     * @param  ?DateTime $day
     * @return int
     */
    public function getTimeSpent(?DateTime $day = null, bool $includeAfterDeadline = false): int
    {
        if ($day === null) {
            $day = $this->owner->author->today;
        }
        $today = $this->owner->author->today;
        $total = 0;
        if (DateHelper::isSameDay($day, $today)) {
            $total += $includeAfterDeadline ? $this->owner->author->getTimerSpent($this->owner) : $this->owner->author->getTimerSpentUntilDeadline($this->owner);
        }
        $total += $includeAfterDeadline ? $this->owner->getTimesheetSpent($day) : $this->owner->getTimesheetSpentUntilDeadline($day);
        return $total;
    }

    /**
     * Is a task complete for any given day, defaults to today if null
     *
     * @param  ?DateTime $day
     * @return bool
     */
    public function isComplete(?DateTime $day = null): bool
    {
        if ($day === null) {
            $day = $this->owner->author->today;
        }
        $today = $this->owner->author->today;
        if (!$this->isActive($day)) {
            return false;
        }
        if (DateHelper::isSameDay($day, $today) and $this->isExpired()) {
            return false;
        }
        if ($this->owner->taskType->value == 'more') {
            return $this->getTimeSpent($day) >= $this->getDuration($day);
        }
        return $this->getTimeSpent($day) <= $this->getDuration($day);
    }

    /**
     * Has a task derailed for any given day, defaults to today if null
     *
     * @param ?DateTime $day
     * @return bool
     */
    public function hasDerailed(?DateTime $day = null): bool
    {
        if ($day === null) {
            $day = $this->owner->author->today;
        }
        $today = $this->owner->author->today;
        if (!$this->isActive($day)) {
            return false;
        }
        if ($this->owner->taskType->value == 'more') {
            if (DateHelper::isSameDay($day, $today) and !$this->isExpired()) {
                return false;
            }
            return $this->getTimeSpent($day) < $this->getDuration($day);
        }
        return $this->getTimeSpent($day) > $this->getDuration($day);
    }

    /**
     * Is this task expired today
     *
     * @return bool
     */
    public function isExpired(): bool
    {
        return $this->isActive() and $this->getTodayDeadline() < DateTimeHelper::toDateTime('now');
    }

    /**
     * Is this task active on any given day, defaults to today if null
     *
     * @param ?DateTime $day
     * @return bool
     */
    public function isActive(?DateTime $day = null): bool
    {
        if ($day === null) {
            $day = $this->owner->author->today;
        }
        return $this->getDuration($day) > 0;
    }

    /**
     * Get today's deadline
     *
     * @return DateTime
     */
    public function getTodayDeadline(): DateTime
    {
        return $this->owner->author->today->setTime($this->owner->deadline->format('H'), $this->owner->deadline->format('i'), 59);
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
        return $today->setTime($this->owner->deadline->format('H'), $this->owner->deadline->format('i'), 59);
    }

    /**
     * Get the time duration for any given day, default to today if null
     *
     * @param  ?DateTime $day
     * @return float
     */
    public function getDuration(?DateTime $day = null): float
    {
        if ($day === null) {
            $day = $this->owner->author->today;
        }
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
}
