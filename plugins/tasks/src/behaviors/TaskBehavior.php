<?php

namespace Plugins\Tasks\behaviors;

use DateInterval;
use DateTime;
use Plugins\Tasks\Tasks;
use Plugins\Tasks\helpers\TimeHelper;
use craft\elements\Entry;
use craft\helpers\DateTimeHelper;
use yii\base\Behavior;

class TaskBehavior extends Behavior
{
    public $owner;
    protected $daily;
    protected $yesterday;
    protected $dailys;

    /**
     * Get the total amount of derailed
     *
     * @return int
     */
    public function getTotalDerailed(): int
    {
        $total = 0;
        foreach ($this->getDailyTasks() as $daily) {
            if ($daily->hasDerailed) {
                $total += 1;
            }
        }
        return $total;
    }

    /**
     * Get the total amount of money charged for derail
     *
     * @return int
     */
    public function getTotalSpent(): int
    {
        $total = 0;
        foreach ($this->getDailyTasks() as $daily) {
            if ($daily->hasDerailed and $daily->chargeSucceeded) {
                $total += $daily->committed->getAmount() / 100;
            }
        }
        return $total;
    }

    /**
     * Get the total worked hours
     *
     * @param  $friendly
     * @return string|int
     */
    public function getTotalWorked($friendly = false)
    {
        $sheets = Entry::find()->section('timesheet')->relatedTo($this->owner);
        $total = 0;
        foreach ($sheets as $sheet) {
            $total += ($sheet->endDate->getTimeStamp() - $sheet->startDate->getTimeStamp());
        }
        if (!$friendly) {
            return $total;
        }
        return TimeHelper::friendlySpentTime($total);
    }

    /**
     * Get the associated daily tasks
     *
     * @return array
     */
    public function getDailyTasks(): array
    {
        if ($this->dailys === null) {
            $this->dailys = Entry::find()->section('dailyTask')->relatedTo($this->owner)->with('task')->all();
        }
        return $this->dailys;
    }

    /**
     * Get the associated daily task
     *
     * @return Entry
     */
    public function getDailyTask(): ?Entry
    {
        if ($this->daily === null) {
            $this->daily = false;
            if ($daily = Tasks::$plugin->tasks->getOrCreateDailyTask($this->owner)) {
                $this->daily = $daily;
            }
        }
        return $this->daily ?: null;
    }

    /**
     * Get the yesterday daily task
     *
     * @return Entry
     */
    public function getYesterdayDailyTask(): ?Entry
    {
        if ($this->yesterday === null) {
            $this->yesterday = false;
            if ($daily = Tasks::$plugin->tasks->getDailyTask($this->owner, $this->owner->author->yesterday)) {
                $this->yesterday = $daily;
            }
        }
        return $this->yesterday ?: null;
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
     * Get the duration in seconds for any given day, default to today if null.
     * For non time based tasks this will return 1 if the task is active for the day, 0 otherwise
     *
     * @param  ?DateTime $day
     * @return float
     */
    public function getDuration(?DateTime $day = null): float
    {
        if ($day === null) {
            $day = $this->owner->author->today;
        }
        $weeks = $this->owner->timeBased ? $this->owner->weeks : $this->owner->weeksToggle;
        $date = $this->owner->startDate;
        if (!$this->owner->recurring) {
            if ($date == $day) {
                return $this->owner->timeBased ? $this->owner->length : 1;
            }
            return 0;
        }
        if ($date <= $day) {
            $thisWeek = $this->beginningOfWeek(clone $day);
            $start = $this->beginningOfWeek($date);
            $current = 0;
            $weeks = $weeks instanceof Collection ? $weeks : $weeks->all();
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
            if (!$this->owner->timeBased) {
                return $length ? 1 : 0;
            }
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
