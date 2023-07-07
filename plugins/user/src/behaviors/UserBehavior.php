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
     * @return DateTimeZone
     */
    public function getTimezoneInstance(): DateTimeZone
    {
        if ($this->owner->timezone) {
            return new DateTimeZone($this->owner->timezone);
        }
        return new DateTimeZone('Europe/London');
    }

    /**
     * Get the now DateTime
     *
     * @return DateTime
     */
    public function getNow(): ?DateTime
    {
        return $this->getDate(new DateTime());
    }

    /**
     * Get the beggining of today DateTime
     *
     * @return DateTime
     */
    public function getToday(): DateTime
    {
        return $this->getNow()->setTime(0, 0, 0);
    }

    /**
     * Get the end of today DateTime
     *
     * @return DateTime
     */
    public function getEndOfToday(): DateTime
    {
        return $this->getNow()->setTime(23, 59, 59);
    }

    /**
     * Get a date in user timezone
     *
     * @param  DateTime $date
     * @return DateTime
     */
    public function getDate(DateTime $date): DateTime
    {
        return (clone $date)->setTimezone($this->getTimezoneInstance());
    }
}
