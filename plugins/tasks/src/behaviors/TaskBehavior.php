<?php

namespace Plugins\Tasks\behaviors;

use DateTime;
use Plugins\Tasks\Tasks;
use craft\helpers\DateTimeHelper;
use yii\base\Behavior;

class TaskBehavior extends Behavior
{
    public $owner;

    public function getIsExpired(): bool
    {
        return $this->owner->endDate < DateTimeHelper::toDateTime('now');
    }
}
