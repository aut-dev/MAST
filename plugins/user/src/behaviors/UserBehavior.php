<?php

namespace Plugins\Users\behaviors;

use yii\base\Behavior;
use DateTimeZone;
use DateTime;

class UserBehavior extends Behavior
{
    public $owner;

    /**
     * Get the user timezone instance
     *
     * @return ?DateTimeZone
     */
    public function getTimezoneInstance(): ?DateTimeZone
    {
        if ($this->owner->timezone) {
            return new DateTimeZone($this->owner->timezone);
        }
        return null;
    }

    /**
     * Get the now DateTime
     *
     * @return ?DateTime
     */
    public function getNow(): ?DateTime
    {
        if ($this->owner->timezone) {
            return (new DateTime())->setTimezone($this->getTimezoneInstance());
        }
        return null;
    }

    /**
     * Get the beggining of today DateTime
     *
     * @return ?DateTime
     */
    public function getToday(): ?DateTime
    {
        if ($this->owner->timezone) {
            return $this->getNow()->setTime(0, 0, 0);
        }
        return null;
    }
}
