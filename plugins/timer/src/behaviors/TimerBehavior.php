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

    public function getTimerSpent(Entry $block): int
    {
        if (!$this->owner->timerStarted) {
            return 0;
        }
        if ($this->owner->taskBlock->one()->id != $block->id) {
            return 0;
        }
        $diff = (new DateTime())->diff($this->owner->timerStarted);
        return ($diff->d * 24 * 60 * 60) + ($diff->h * 60 * 60) + ($diff->i * 60) + $diff->s;
    }
}
