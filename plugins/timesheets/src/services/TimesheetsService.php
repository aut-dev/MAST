<?php

namespace Plugins\Timesheets\services;

use DateTime;
use Exception;
use craft\base\Component;
use craft\base\Element;
use craft\elements\Entry;
use craft\elements\User;
use DateInterval;

class TimesheetsService extends Component
{
    public function addTimesheet(Entry $task, DateTime $startDate, DateTime $endDate): Entry
    {
        $section = \Craft::$app->sections->getSectionByHandle('timesheet');
        $types = $section->entryTypes;
        $type = reset($types);
        if ($task->isComplete and $task->taskType->value == 'more') {
            $startDate->add(new DateInterval('P1D'));
            $endDate->add(new DateInterval('P1D'));
        }
        $sheet = new Entry([
            'sectionId' => $section->id,
            'typeId' => $type->id,
            'authorId' => $task->authorId,
        ]);
        $sheet->setFieldValues([
            'task' => [$task->id],
            'startDate' => $startDate,
            'endDate' => $endDate,
        ]);
        $sheet->scenario = Element::SCENARIO_LIVE;
        if (\Craft::$app->elements->saveElement($sheet)) {
            return $sheet;
        }
        throw new Exception("Couldn't save timesheet : " . print_r($sheet->errors, true));
    }

    public function deleteForTask(Entry $task, bool $hardDelete)
    {
        $sheets = Entry::find()->section('timesheet')->anyStatus()->trashed(null)->relatedTo($task)->all();
        foreach ($sheets as $sheet) {
            \Craft::$app->elements->deleteElement($sheet, $hardDelete);
        }
    }
}
