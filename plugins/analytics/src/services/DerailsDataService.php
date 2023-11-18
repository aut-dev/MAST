<?php

namespace Plugins\Analytics\services;

use DateTime;
use Plugins\Tasks\helpers\DateHelper;
use craft\elements\Entry;
use craft\elements\User;
use craft\elements\db\EntryQuery;
use DateInterval;

class DerailsDataService extends DataService
{
    public function forPie(User $user, array $filters)
    {
        $tasks = $this->getTasks($user, $filters);
        list($dateFrom, $dateTo) = $this->getDates($user, $filters);
        $query = $this->_query($tasks, $dateFrom, $dateTo);
        $data = [];
        foreach ($query->all() as $daily) {
            $task = $daily->task->first();
            if (!isset($data[$task->id])) {
                $data[$task->id] = 0;
            }
            $data[$task->id]++;
        }
        $colors = $labels = $dataset = [];
        foreach ($tasks as $task) {
            $dataset[] = $data[$task->id] ?? 0;
            $labels[] = $task->title;
            $colors[] = (string)$task->color;
        }
        return [
            'labels' => $labels,
            'datasets' => [[
                'label' => 'Derails',
                'data' => $dataset,
                'backgroundColor' => $colors
            ]]
        ];
    }

    public function forLine(User $user, array $filters): array
    {
        $groupBy = $filters['groupBy'] ?? 'months';
        if (!in_array($groupBy, ['days', 'months'])) {
            throw new Exception("groupBy parameter can only be one of : days or months");
        }
        $tasks = $this->getTasks($user, $filters);
        list($dateFrom, $dateTo) = $this->getDates($user, $filters);
        $query = $this->_query($tasks, $dateFrom, $dateTo);
        $cumulative = $filters['cumulative'] ?? false;
        $data = [];
        foreach ($query->all() as $daily) {
            $index = $this->getGroupByIndex($daily->startDate, $groupBy);
            $task = $daily->task->first();
            if (!isset($data[$task->id][$index])) {
                $data[$task->id][$index] = 0;
            }
            $data[$task->id][$index]++;
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
                $datasets[$task->id]['data'][] = $value;
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

    protected function _query(array $tasks, DateTime $dateFrom, DateTime $dateTo): EntryQuery
    {
        $dailys = Entry::find()->section('dailyTask')->hasDerailed(true)->with('task')->relatedTo($tasks)->orderBy('startDate asc');
        DateHelper::addDateParamsBetween($dailys, $dateFrom, $dateTo);
        return $dailys;
    }
}
