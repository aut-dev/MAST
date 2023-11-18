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
    public function forPie(User $user, array $filters)
    {
        $tasks = $this->getTasks($user, $filters);
        list($dateFrom, $dateTo) = $this->getDates($user, $filters);
        $query = $this->_query($tasks, $dateFrom, $dateTo);
        $data = [];
        foreach ($query->all() as $sheet) {
            $task = $sheet->task->first();
            list($startDate, $endDate) = $this->getSheetDates($sheet, $dateFrom, $dateTo);
            if (!isset($data[$task->id])) {
                $data[$task->id] = 0;
            }
            $data[$task->id] += ($endDate->getTimeStamp() - $startDate->getTimeStamp());
        }
        $colors = $labels = $dataset = [];
        foreach ($tasks as $task) {
            $dataset[] = round(($data[$task->id] ?? 0) / 60);
            $labels[] = $task->title;
            $colors[] = (string)$task->color;
        }
        return [
            'labels' => $labels,
            'datasets' => [[
                'label' => 'Time spent',
                'data' => $dataset,
                'backgroundColor' => $colors
            ]]
        ];
    }

    public function forLine(User $user, array $filters): array
    {
        $groupBy = $this->getGroupBy($filters);
        $cumulative = $filters['cumulative'] ?? false;
        $tasks = $this->getTasks($user, $filters);
        list($dateFrom, $dateTo) = $this->getDates($user, $filters);
        $query = $this->_query($tasks, $dateFrom, $dateTo);
        $data = [];
        foreach ($query->all() as $sheet) {
            list($startDate, $endDate) = $this->getSheetDates($sheet, $dateFrom, $dateTo);
            $index = $this->getGroupByIndex($startDate, $groupBy);
            $task = $sheet->task->first();
            if (!isset($data[$task->id][$index])) {
                $data[$task->id][$index] = 0;
            }
            $data[$task->id][$index] += ($endDate->getTimeStamp() - $startDate->getTimeStamp());
        }
        $datasets = $labels = [];
        foreach ($tasks as $task) {
            $datasets[$task->id] = [
                'label' => $task->title,
                'tension' => 0.2,
                'data' => [],
                'borderColor' => (string)$task->color
            ];
        }
        $next = $dateFrom;
        $cumulatives = [];
        while (1) {
            $index = $this->getGroupByIndex($next, $groupBy);
            $labels[] = $this->getGroupByLabel($next, $groupBy);
            switch ($groupBy) {
                case 'days':
                    $next->add(new DateInterval('P1D'));
                    break;
                case 'months':
                    $next->add(new DateInterval('P1M'));
            }
            foreach ($tasks as $task) {
                $value = $data[$task->id][$index] ?? 0;
                if ($cumulative) {
                    $cumulatives[$task->id] = ($cumulatives[$task->id] ?? 0) + $value;
                    $value = $cumulatives[$task->id];
                }
                $datasets[$task->id]['data'][] = round($value / 60);
            }
            if ($next > $dateTo) {
                break;
            }
        }
        return [
            'labels' => $labels,
            'datasets' => array_values($datasets)
        ];
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
