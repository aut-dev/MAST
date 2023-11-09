<?php

namespace Plugins\Analytics\services;

use DateInterval;
use DateTime;
use Exception;
use Plugins\Tasks\helpers\DateHelper;
use craft\base\Component;
use craft\elements\Entry;
use craft\elements\User;
use craft\helpers\MoneyHelper;

class AnalyticsService extends Component
{
    public function timePerTaskData(User $user, string $groupBy, DateTime $dateFrom, DateTime $dateTo): array
    {
        if (!in_array($groupBy, ['days', 'months'])) {
            throw new Exception("groupBy parameter can only be one of : days or months");
        }
        $tasks = Entry::find()->authorId($user->id)->section('task')->all();
        $sheets = Entry::find()->section('timesheet')->with('task')->relatedTo($tasks);
        DateHelper::add2DatesParamsBetween($sheets, $dateFrom, $dateTo);
        $data = [];
        foreach ($sheets->all() as $sheet) {
            $endDate = $sheet->endDate;
            $startDate = $sheet->startDate;
            if ($endDate > $dateTo) {
                $endDate = $dateTo;
            }
            if ($startDate < $dateFrom) {
                $startDate = $dateFrom;
            }
            switch ($groupBy) {
                case 'days':
                    $index = $startDate->format('Y/m/d');
                    break;
                case 'months':
                    $index = $startDate->format('Y/m');
            }
            $task = $sheet->task->first();
            if (!isset($data[$task->id][$index])) {
                $data[$task->id][$index] = 0;
            }
            $data[$task->id][$index] += ($endDate->getTimeStamp() - $startDate->getTimeStamp());
        }
        $datasets = $labels = [];
        $next = $dateFrom;
        while (1) {
            switch ($groupBy) {
                case 'days':
                    $index = $next->format('Y/m/d');
                    $label = $next->format('d/m/Y');
                    $next->add(new DateInterval('P1D'));
                    break;
                case 'months':
                    $index = $next->format('Y/m');
                    $label = $next->format('m/Y');
                    $next->add(new DateInterval('P1M'));
            }
            $labels[] = $label;
            foreach ($tasks as $task) {
                $datasets[$task->id]['label'] = $task->title;
                $datasets[$task->id]['tension'] = 0.2;
                $datasets[$task->id]['data'][] = round(($data[$task->id][$index] ?? 0) / 60);
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

    public function derailsPerTaskData(User $user, string $groupBy, DateTime $dateFrom, DateTime $dateTo): array
    {
        if (!in_array($groupBy, ['days', 'months'])) {
            throw new Exception("groupBy parameter can only be one of : days or months");
        }
        $tasks = Entry::find()->authorId($user->id)->section('task')->all();
        $dailys = Entry::find()->section('dailyTask')->hasDerailed(true)->with('task')->relatedTo($tasks);
        DateHelper::addDateParamsBetween($dailys, $dateFrom, $dateTo);
        $data = [];
        foreach ($dailys->all() as $daily) {
            $startDate = $daily->startDate;
            switch ($groupBy) {
                case 'days':
                    $index = $startDate->format('Y/m/d');
                    break;
                case 'months':
                    $index = $startDate->format('Y/m');
            }
            $task = $daily->task->first();
            if (!isset($data[$task->id][$index])) {
                $data[$task->id][$index] = 0;
            }
            $data[$task->id][$index]++;
        }
        $datasets = $labels = [];
        $next = $dateFrom;
        while (1) {
            switch ($groupBy) {
                case 'days':
                    $index = $next->format('Y/m/d');
                    $label = $next->format('d/m/Y');
                    $next->add(new DateInterval('P1D'));
                    break;
                case 'months':
                    $index = $next->format('Y/m');
                    $label = $next->format('m/Y');
                    $next->add(new DateInterval('P1M'));
            }
            $labels[] = $label;
            foreach ($tasks as $task) {
                $datasets[$task->id]['label'] = $task->title;
                $datasets[$task->id]['tension'] = 0.2;
                $datasets[$task->id]['data'][] = $data[$task->id][$index] ?? 0;
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

    public function moneyPerTaskData(User $user, string $groupBy, DateTime $dateFrom, DateTime $dateTo): array
    {
        if (!in_array($groupBy, ['days', 'months'])) {
            throw new Exception("groupBy parameter can only be one of : days or months");
        }
        $tasks = Entry::find()->authorId($user->id)->section('task')->all();
        $dailys = Entry::find()->section('dailyTask')->chargeSucceeded(true)->with('task')->relatedTo($tasks);
        DateHelper::addDateParamsBetween($dailys, $dateFrom, $dateTo);
        $data = [];
        foreach ($dailys->all() as $daily) {
            $startDate = $daily->startDate;
            switch ($groupBy) {
                case 'days':
                    $index = $startDate->format('Y/m/d');
                    break;
                case 'months':
                    $index = $startDate->format('Y/m');
            }
            $task = $daily->task->first();
            if (!isset($data[$task->id][$index])) {
                $data[$task->id][$index] = 0;
            }
            $data[$task->id][$index] += MoneyHelper::toNumber($daily->committed);
        }
        $datasets = $labels = [];
        $next = $dateFrom;
        while (1) {
            switch ($groupBy) {
                case 'days':
                    $index = $next->format('Y/m/d');
                    $label = $next->format('d/m/Y');
                    $next->add(new DateInterval('P1D'));
                    break;
                case 'months':
                    $index = $next->format('Y/m');
                    $label = $next->format('m/Y');
                    $next->add(new DateInterval('P1M'));
            }
            $labels[] = $label;
            foreach ($tasks as $task) {
                $datasets[$task->id]['label'] = $task->title;
                $datasets[$task->id]['tension'] = 0.2;
                $datasets[$task->id]['data'][] = $data[$task->id][$index] ?? 0;
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
}
