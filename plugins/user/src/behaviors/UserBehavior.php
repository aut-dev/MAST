<?php

namespace Plugins\Users\behaviors;

use yii\base\Behavior;

class UserBehavior extends Behavior
{
    public $owner;

    public function getTimezoneInstance(): ?\DateTimeZone
    {
        if ($this->owner->timezone) {
            return new \DateTimeZone($this->owner->timezone);
        }
        return null;
    }

    public function getNow(): ?\DateTime
    {
        if ($this->owner->timezone) {
            return (new \DateTime())->setTimezone($this->getTimezoneInstance());
        }
        return null;
    }

    public function getToday(): ?\DateTime
    {
        if ($this->owner->timezone) {
            return $this->getNow()->setTime(0, 0, 0);
        }
        return null;
    }

    public function getEndOfToday(): ?\DateTime
    {
        if ($this->owner->timezone) {
            return $this->getNow()->setTime(23, 59, 59);
        }
        return null;
    }
}
