<?php

namespace Plugins\Tasks\behaviors;

use DateTime;
use Plugins\Tasks\Tasks;
use craft\helpers\DateTimeHelper;
use yii\base\Behavior;

class TaskBehavior extends Behavior
{
    public $owner;

    public function getExpiringDate(): \DateTime
    {
        $date = $this->owner->startDate;
        $deadline = $this->owner->deadline;
        $date->setTime($deadline->format('H'), $deadline->format('i'), 59);
        return $date;
    }

    public function getIsExpired(): bool
    {
        return $this->getExpiringDate() < DateTimeHelper::toDateTime('now');
    }
}
