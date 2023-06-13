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

    public function getIsComplete()
    {
        if (!$this->getIsActiveToday() or $this->getIsExpired()) {
            return false;
        }
        if ($this->owner->taskType->value == 'more') {
            return $this->getTimeSpent() >= $this->getTodayDuration();
        }
        return $this->getTimeSpent() <= $this->getTodayDuration();
    }

    public function getIsDerailed()
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

    public function getTimeSpent(): int
    {
        if ($this->_spent === null) {
            $timer = $this->owner->author->getTimerSpent($this->owner);
            $sheets = $this->owner->getTimesheetSpentToday();
            $this->_spent = $timer + $sheets;
        }
        return $this->_spent;
    }

    public function getExpiringDate(): DateTime
    {
        $date = $this->owner->author->endOfToday;
        $date->setTime($this->owner->deadline->format('H'), $this->owner->deadline->format('i'), 59);
        return $date;
    }

    public function getIsExpired(): bool
    {
        return $this->getIsActiveToday() and $this->getExpiringDate() < DateTimeHelper::toDateTime('now');
    }

    public function getTodayDuration(): int
    {
        if ($this->_todayDuration === null) {
            $this->_todayDuration = 0;
            $today = $this->owner->author->today;
            if ($this->owner->startDate <= $today) {
                $thisWeek = $this->beginningOfWeek(clone $today);
                $start = $this->beginningOfWeek(clone $this->owner->startDate);
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
                $day = strtolower($today->format('D'));
                $length = $week[$day];
                $this->_todayDuration = $length * $this->owner->length;
            }
        }
        return $this->_todayDuration;
    }

    public function getIsActiveToday()
    {
        return $this->getTodayDuration() > 0;
    }

    protected function beginningOfWeek(DateTime $date)
    {
        while ($date->format('D') != 'Mon') {
            $date->sub(new DateInterval('P1D'));
        }
        return $date;
    }
}
