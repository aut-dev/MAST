<?php

namespace Plugins\Analytics\services;

use DateInterval;
use DateTime;
use Plugins\Tasks\helpers\DateHelper;
use craft\elements\Entry;
use craft\elements\User;
use craft\elements\db\EntryQuery;

class TimeSpentDataService extends DataService
{
    protected function processData(array $sheets, array &$data)
    {
        list($dateFrom, $dateTo) = $this->getDates();
        foreach ($sheets as $sheet) {
            $task = $sheet->task->first();
            list($startDate, $endDate) = $this->getSheetDates($sheet, $dateFrom, $dateTo);
            if (!isset($data[$task->id])) {
                $data[$task->id] = 0;
            }
            $data[$task->id] += ($endDate->getTimeStamp() - $startDate->getTimeStamp());
        }
    }

    protected function processLineData(array $sheets, array &$data, string $groupBy)
    {
        list($dateFrom, $dateTo) = $this->getDates();
        foreach ($sheets as $sheet) {
            list($startDate, $endDate) = $this->getSheetDates($sheet, $dateFrom, $dateTo);
            $index = $this->getGroupByIndex($startDate, $groupBy);
            $task = $sheet->task->first();
            if (!isset($data[$task->id][$index])) {
                $data[$task->id][$index] = 0;
            }
            $data[$task->id][$index] += ($endDate->getTimeStamp() - $startDate->getTimeStamp());
        }
    }

    protected function getSheetDates(Entry $sheet, DateTime $dateFrom, DateTime $dateTo): array
    {
        $endDate = $sheet->endDate;
        $startDate = $sheet->startDate;
        if ($endDate > $dateTo) {
            $endDate = $dateTo;
        }
        if ($startDate < $dateFrom) {
            $startDate = $dateFrom;
        }
        return [$startDate, $endDate];
    }

    protected function _query(array $tasks, DateTime $dateFrom, DateTime $dateTo): EntryQuery
    {
        $sheets = Entry::find()->section('timesheet')->with('task')->relatedTo($tasks)->orderBy('startDate asc');
        DateHelper::add2DatesParamsBetween($sheets, $dateFrom, $dateTo);
        return $sheets;
    }
}
