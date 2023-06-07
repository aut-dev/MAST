<?php

namespace Plugins\Timesheets\services;

use DateTime;
use Exception;
use craft\base\Component;
use craft\base\Element;
use craft\elements\Entry;
use craft\elements\User;

class TimesheetsService extends Component
{
    public function addTimesheet(Entry $task, DateTime $startTime, DateTime $endTime): Entry
    {
        $section = \Craft::$app->sections->getSectionByHandle('timesheet');
        $types = $section->entryTypes;
        $type = reset($types);
        $sheet = new Entry([
            'sectionId' => $section->id,
            'typeId' => $type->id,
            'authorId' => $task->authorId,
        ]);
        $sheet->setFieldValues([
            'scheduledTask' => [$task->id],
            'startTime' => $startTime,
            'endTime' => $endTime,
        ]);
        $sheet->scenario = Element::SCENARIO_LIVE;
        if (\Craft::$app->elements->saveElement($sheet)) {
            return $sheet;
        }
        throw new Exception("Couldn't save timesheet : " . print_r($sheet->errors, true));
    }

    public function onTimesheetChange(Entry $sheet)
    {
        $task = $sheet->scheduledTask->one();
        if (!$task or $task->isComplete) {
            return;
        }
        if ($task->timeSpent > $task->length) {
            $task->setFieldValue('isComplete', true);
            \Craft::$app->elements->saveElement($task, false);
        }
    }
}
