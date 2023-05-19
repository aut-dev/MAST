<?php

namespace Plugins\Timer\behaviors;

use DateTime;
use yii\base\Behavior;

class TimerBehavior extends Behavior
{
    public $owner;

    public function isTimerStarted()
    {
        return $this->owner->timerStarted != null;
    }

    /**
     * Get the amount of hours and minutes elapsed since the timer started
     *
     * @return array
     */
    public function getTimerElapsed(): array
    {
        $minutes = 0;
        if ($this->owner->timerStarted) {
            $diff = (new DateTime())->diff($this->owner->timerStarted);
            $minutes += ($diff->d * 24 * 60) + ($diff->h * 60) + $diff->i;
        }
        return [floor($minutes / 60), $minutes % 60];
    }
}
