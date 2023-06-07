<?php

namespace Plugins\Timer\behaviors;

use DateTime;
use craft\elements\Entry;
use yii\base\Behavior;

class TimerBehavior extends Behavior
{
    public $owner;

    public function isTimerStarted()
    {
        return $this->owner->timerStarted != null;
    }

    public function getTimerSpent(Entry $task): int
    {
        if (!$this->owner->timerStarted) {
            return 0;
        }
        if ($this->owner->timerTask->one()->id != $task->id) {
            return 0;
        }
        $diff = $this->owner->now->diff($this->owner->timerStarted);
        return ($diff->d * 24 * 60) + ($diff->h * 60) + $diff->i;
    }
}
