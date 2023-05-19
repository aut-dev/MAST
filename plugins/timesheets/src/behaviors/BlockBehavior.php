<?php

namespace Plugins\Timesheets\behaviors;

use DateTime;
use Plugins\Tasks\Tasks;
use craft\elements\Entry;
use yii\base\Behavior;

class BlockBehavior extends Behavior
{
    public $owner;

    public function getTimeSpent(): int
    {
        $sheets = Entry::find()->section('timesheet')->relatedTo($this->owner)->all();
        $time = 0;
        foreach ($sheets as $sheet) {
            $diff = ($sheet->endTime)->diff($sheet->startTime);
            $time += ($diff->d * 24 * 60 * 60) + ($diff->h * 60 * 60) + ($diff->i * 60) + $diff->s;
        }
        return $time;
    }
}
