<?php

namespace Plugins\Timesheets\behaviors;

use DateTime;
use Plugins\Tasks\Tasks;
use Plugins\Tasks\helpers\DateHelper;
use craft\elements\Entry;
use yii\base\Behavior;

class TaskBehavior extends Behavior
{
    public $owner;

    public function getTimesheetSpentToday(): int
    {
        $sheets = Entry::find()->section('timesheet')->relatedTo($this->owner);
        DateHelper::addDateParamsBetween($sheets, $this->owner->author->today, $this->owner->author->endOfToday);
        $time = 0;
        foreach ($sheets->all() as $sheet) {
            $time += ($sheet->endDate->getTimeStamp() - $sheet->startDate->getTimeStamp());
        }
        return $time;
    }
}
