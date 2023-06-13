<?php

namespace Plugins\Timer\behaviors;

use DateTime;
use Plugins\Timer\Timer;
use craft\elements\Entry;
use yii\base\Behavior;

class TimerBehavior extends Behavior
{
    public $owner;

    public function timerStarted(int $taskId): ?DateTime
    {
        return Timer::$plugin->timer->timerStarted($taskId, $this->owner);
    }

    public function getTimerSpent(Entry $task): int
    {
        $date = $this->timerStarted($task->id);
        if (!$date) {
            return 0;
        }
        return $this->owner->now->getTimeStamp() - $date->getTimeStamp();
    }
}
