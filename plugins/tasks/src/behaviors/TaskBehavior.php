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
            $query = Entry::find()->section('dailyTask')->relatedTo($this->owner)->with('task');
            if (!$this->owner->enabled) {
                $query->anyStatus();
            }
            $this->dailys = $query->all();
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
     * Get today's deadline
     *
     * @return DateTime
     */
    public function getTodayDeadline(): DateTime
    {
        return $this->owner->author->today->setTime($this->owner->deadline->format('H'), $this->owner->deadline->format('i'), 59);
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
     * Get the duration in seconds for any given day, default to today if null
     *
     * @param  ?DateTime $day
     * @return float
     */
    public function getDuration(?DateTime $day = null): float
    {
        if (!$this->owner->timeBased or !$this->owner->startDate) {
            return 0;
        }
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
