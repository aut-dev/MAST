<?php

namespace Plugins\Timesheets\services;

use DateInterval;
use DateTime;
use Exception;
use Plugins\Tasks\helpers\DateHelper;
use craft\base\Component;
use craft\base\Element;
use craft\elements\Entry;
use craft\elements\User;

class TimesheetsService extends Component
{
    /**
     * Add a timesheet for a task.
     * May create 2 timesheets if the dates are between the deadline of the task
     *
     * @param Entry    $task
     * @param DateTime $startDate
     * @param DateTime $endDate
     */
    public function addTimesheet(Entry $task, DateTime $startDate, DateTime $endDate): Entry
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

    /**
     * Get the time (in seconds) recorded in timesheets between 2 dates for a task
     *
     * @param  Entry    $task
     * @param  DateTime $start
     * @param  DateTime $end
     * @return int
     */
    public function getTimeRecorded(Entry $task, DateTime $start, DateTime $end): int
    {
        $sheets = Entry::find()->section('timesheet')->relatedTo($task);
        DateHelper::add2DatesParamsBetween($sheets, $start, $end);
        $time = 0;
        foreach ($sheets->all() as $sheet) {
            $endDate = $sheet->endDate;
            $startDate = $sheet->startDate;
            if ($endDate > $end) {
                $endDate = $end;
            }
            if ($startDate < $start) {
                $startDate = $start;
            }
            $time += ($endDate->getTimeStamp() - $startDate->getTimeStamp());
        }
        return $time;
    }

    /**
     * Delete all timesheets for a task
     *
     * @param  Entry  $task
     * @param  bool   $hardDelete
     */
    public function deleteForTask(Entry $task, bool $hardDelete)
    {
        $sheets = Entry::find()->section('timesheet')->trashed(null)->relatedTo($task)->all();
        foreach ($sheets as $sheet) {
            \Craft::$app->elements->deleteElement($sheet, $hardDelete);
        }
    }

    /**
     * Restore all timesheets for a task
     *
     * @param  Entry  $task
     */
    public function restoreForTask(Entry $task)
    {
        $dailys = Entry::find()->section('timesheet')->trashed(null)->relatedTo($task)->all();
        \Craft::$app->elements->restoreElements($dailys);
    }

    /**
     * Timesheet custom validation rules
     *
     * @param  Entry  $sheet
     */
    public function validateTimesheet(Entry $sheet)
    {
        if ($sheet->startDate and $sheet->endDate and $sheet->startDate >= $sheet->endDate) {
            $sheet->addError('startDate', \Craft::t('site', 'Start date must be before end date'));
        }
    }
}
