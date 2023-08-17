<?php

namespace Plugins\Tasks\behaviors;

use DateInterval;
use DateTime;
use Illuminate\Support\Collection;
use Plugins\Tasks\helpers\DateHelper;
use Plugins\Timesheets\Timesheets;
use craft\elements\Entry;
use craft\helpers\DateTimeHelper;
use yii\base\Behavior;

class DailyTaskBehavior extends Behavior
{
    public $owner;
    protected $_task;
    protected $_timeSpent;
    protected $_timeSpentAfterDeadline;

    /**
     * Get the associated task
     *
     * @return Entry
     */
    public function getTask(): Entry
    {
        if ($this->_task === null) {
            if ($this->owner->task instanceof Collection) {
                $this->_task = $this->owner->task->first();
            } else {
                $this->_task = $this->owner->task->one();
            }
        }
        return $this->_task;
    }

    /**
     * Has the daily task derailed. this will NOT check if the task is paused or active
     *
     * @return bool
     */
    public function hasDerailed(): bool
    {
        if (!$this->owner->timeBased) {
            if (!$this->isExpired()) {
                return false;
            }
            return !$this->owner->done;
        }
        $timeSpent = $this->getTimeSpent();
        if ($this->owner->taskType->value == 'more') {
            $deadline = $this->getDeadlineInstance();
            $secondsLeft = $deadline->getTimeStamp() - $this->owner->author->now->getTimeStamp();
            if ($secondsLeft > 0 and $secondsLeft < ($this->owner->length - $timeSpent)) {
                //Not enough time before deadline to finish it, so it's derailed
                return true;
            }
            if (!$this->isExpired()) {
                return false;
            }
            return $timeSpent < $this->owner->length;
        }
        return $timeSpent > $this->owner->length;
    }

    /**
     * Is this task paused
     *
     * @return boolean
     */
    public function isPaused(): bool
    {
        return ($this->owner->paused or $this->owner->author->isOnBreak($this->owner->startDate));
    }

    /**
     * Is this daily task active
     *
     * @return bool
     */
    public function isActive(): bool
    {
        if (!$this->owner->timeBased) {
            return true;
        }
        return $this->owner->length > 0;
    }

    /**
     * Is this daily task expired
     *
     * @return bool
     */
    public function isExpired(): bool
    {
        return $this->getDeadlineInstance() < DateTimeHelper::toDateTime('now');
    }

    /**
     * Is this daily task complete
     *
     * @return bool
     */
    public function isComplete(): bool
    {
        if (!$this->task->timeBased) {
            return $this->owner->done;
        }
        if ($this->owner->taskType->value == 'more') {
            return $this->getTimeSpent() >= $this->owner->length;
        }
        return $this->getTimeSpent() <= $this->owner->length;
    }

    /**
     * Get the time spent in seconds on that daily task.
     * Includes timesheets + timer (if today)
     * if $includeAfterDeadline is true it will return all the time recorded after the deadline has passed (until midnight),
     * otherwise will only return until the deadline.
     * Will start counting from yesterday's task deadline if existing.
     *
     * @param  bool $includeAfterDeadline
     * @return int
     */
    public function getTimeSpent(bool $includeAfterDeadline = false): int
    {
        if ($includeAfterDeadline) {
            if ($this->_timeSpentAfterDeadline === null) {
                $this->_timeSpentAfterDeadline = $this->_getTimeSpent(true);
            }
            return $this->_timeSpentAfterDeadline;
        }
        if ($this->_timeSpent === null) {
            $this->_timeSpent = $this->_getTimeSpent(false);
        }
        return $this->_timeSpent;
    }

    /**
     * Get the progress in %
     *
     * @return float
     */
    public function getProgress(bool $includeAfterDeadline = false): float
    {
        if (!$this->owner->length) {
            return 0;
        }
        return $this->getTimeSpent($includeAfterDeadline) / $this->owner->length * 100;
    }

    /**
     * Get the previous daily task
     *
     * @return ?Entry
     */
    public function getPreviousTask(): ?Entry
    {
        return $this->getPreviousTasks()[0] ?? null;
    }

    /**
     * Get the previous daily tasks, ordered by date desc
     *
     * @return array
     */
    public function getPreviousTasks(): array
    {
        $entries = Entry::find()->section('dailyTask')->relatedTo($this->getTask())->with('task')->orderBy('startDate desc');
        DateHelper::addDateParamsSmallerThan($entries, $this->owner->startDate, 'startDate', true);
        return $entries->all();
    }

    /**
     * Get the deadline datetime
     *
     * @return DateTime
     */
    public function getDeadlineInstance(): DateTime
    {
        return $this->owner->author->getDate($this->owner->startDate)->setTime($this->owner->deadline->format('H'), $this->owner->deadline->format('i'), 59);
    }

    /**
     * @param  bool $includeAfterDeadline
     * @return int
     */
    protected function _getTimeSpent(bool $includeAfterDeadline = false): int
    {
        $start = $this->owner->author->getDate($this->owner->startDate);
        $total = 0;
        $deadline = $this->getDeadlineInstance();
        if ($includeAfterDeadline) {
            $deadline->setTime(23, 59, 59);
        }
        $total += $this->owner->author->getTimerSpent($this->getTask(), $deadline);
        if ($previousTask = $this->getPreviousTask() and DateHelper::isTheDayBefore($previousTask->startDate, $this->owner->startDate)) {
            $start = $previousTask->getDeadlineInstance();
        }
        $total += Timesheets::$plugin->timesheets->getTimeRecorded($this->getTask(), $start, $deadline);
        return $total;
    }
}
