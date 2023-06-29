<?php

namespace Plugins\Timesheets\behaviors;

use Plugins\Timesheets\Timesheets;
use yii\base\Behavior;
use DateInterval;
use DateTime;

class TimesheetBehavior extends Behavior
{
    public $owner;

    public function friendlySpentTime()
    {
        $diff = $this->owner->endDate->diff($this->owner->startDate);
        $friendly = '';
        if ($diff->d) {
            $friendly .= $diff->d . 'd';
        }
        if ($diff->h) {
            $friendly .= $diff->h . 'm';
        }
        if ($diff->i) {
            $friendly .= $diff->i . 'm';
        }
        $friendly .= $diff->s . 's';
        return $friendly;
    }
}
