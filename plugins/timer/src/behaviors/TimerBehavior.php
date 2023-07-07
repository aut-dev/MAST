<?php

namespace Plugins\Timer\behaviors;

use DateTime;
use Plugins\Timer\Timer;
use craft\elements\Entry;
use yii\base\Behavior;

class TimerBehavior extends Behavior
{
    public $owner;

    /**
     * Get the date the timer was started for a task id
     *
     * @param  int    $taskId
     * @return ?DateTime
     */
    public function timerStarted(int $taskId): ?DateTime
    {
        return Timer::$plugin->timer->timerStarted($taskId, $this->owner);
    }

    /**
     * Get the time spent on a task, until a deadline. Will return 0 if timer was started after the deadline
     *
     * @param  Entry $task
     * @return int
     */
    public function getTimerSpent(Entry $task, DateTime $deadline): int
    {
        $date = $this->timerStarted($task->id);
        if (!$date or $date > $deadline) {
            return 0;
        }
        if ($this->owner->now > $deadline) {
            return $deadline->getTimeStamp() - $date->getTimeStamp();
        }
        return $this->owner->now->getTimeStamp() - $date->getTimeStamp();
    }
}
