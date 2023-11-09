<?php

namespace Plugins\Users\behaviors;

use DateTime;
use DateInterval;
use DateTimeZone;
use Plugins\Users\Users;
use craft\helpers\DateTimeHelper;
use yii\base\Behavior;

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
     * Get the beggining of yesterday DateTime
     *
     * @return DateTime
     */
    public function getYesterday(): DateTime
    {
        return $this->getToday()->sub(new DateInterval('P1D'));
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

    /**
     * Is the user on a break for a given day
     *
     * @param  DateTime $date
     * @return boolean
     */
    public function isOnBreak(DateTime $day): bool
    {
        return ($this->isOnUnlimitedBreak($day) or $this->isOnScheduledBreak($day));
    }

    /**
     * Is the user on a break today
     *
     * @return boolean
     */
    public function isOnBreakToday(): bool
    {
        return $this->isOnBreak($this->owner->today);
    }

    /**
     * Is the user on unlimited break
     *
     * @param  ?DateTime $date
     * @return boolean
     */
    public function isOnUnlimitedBreak(?DateTime $date = null): bool
    {
        if (!$date) {
            $date = DateTimeHelper::toDateTime('now');
        }
        return ($this->owner->unlimitedBreakStart and $this->owner->unlimitedBreakStart <= $date);
    }

    /**
     * Is the user on a scheduled break
     *
     * @param  DateTime $day
     * @return boolean
     */
    public function isOnScheduledBreak(DateTime $day): bool
    {
        return Users::$plugin->breaks->isOnBreak($this->owner, $day);
    }
}
