<?php

namespace Plugins\Timesheets\behaviors;

use DateInterval;
use DateTime;
use Plugins\Tasks\helpers\TimeHelper;
use Plugins\Timesheets\Timesheets;
use yii\base\Behavior;

class TimesheetBehavior extends Behavior
{
    public $owner;

    public function friendlySpentTime()
    {
        $diff = $this->owner->endDate->diff($this->owner->startDate);
        return TimeHelper::friendlyDiffTime($diff);
    }
}
