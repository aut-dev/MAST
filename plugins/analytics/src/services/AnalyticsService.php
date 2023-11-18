<?php

namespace Plugins\Analytics\services;

use DateInterval;
use DateTime;
use Exception;
use Plugins\Tasks\helpers\DateHelper;
use Plugins\Tasks\helpers\TimeHelper;
use craft\base\Component;
use craft\elements\Entry;
use craft\elements\MatrixBlock;
use craft\elements\User;
use craft\helpers\Json;
use craft\helpers\MoneyHelper;

class AnalyticsService extends Component
{
    /**
     * Get a chart as json
     *
     * @param  MatrixBlock $chart
     * @return array
     */
    public function getJsonChart(MatrixBlock $chart): array
    {
        return [
            'chartType' => $chart->chartType->value,
            'dataTracked' => $chart->dataTracked->value,
            'size' => $chart->size->value,
            'id' => $chart->id,
            'chartTitle' => $chart->chartTitle,
            'allTasks' => $chart->allTasks,
            'tasks' => $chart->allTasks ? [] : $chart->tasks->ids(),
            'groupBy' => $chart->groupBy->value,
            'dateRange' => $chart->dateRange->value,
            'dateFrom' => $chart->dateRange->value == 'custom' ? $chart->dateFrom->format('Y-m-d') : '',
            'dateTo' => $chart->dateRange->value == 'custom' ? $chart->dateTo->format('Y-m-d') : '',
            'cumulative' => $chart->cumulative
        ];
    }

    /**
     * Get some all time metrics
     *
     * @return array
     */
    public function getMetrics(User $user): array
    {
        $metrics = [
            'tasks' => [],
            'totals' => [
                'spent' => 0,
                'time' => 0,
                'derails' => 0,
                'completed' => 0,
            ]
        ];
        foreach (Entry::find()->section('task')->authorId($user->id)->all() as $task) {
            $spent = $task->getTotalSpent();
            $time = $task->getTotalWorked();
            $derails = $task->getTotalDerailed();
            $completed = $task->getTotalCompleted();
            $metrics['tasks'][] = [
                'task' => $task,
                'spent' => number_format($spent, 2),
                'time' => TimeHelper::friendlySpentTime($time),
                'derails' => $derails,
                'completed' => $completed,
            ];
            $metrics['totals']['spent'] += $spent;
            $metrics['totals']['time'] += $time;
            $metrics['totals']['derails'] += $derails;
            $metrics['totals']['completed'] += $completed;
        }
        $metrics['totals']['time'] = TimeHelper::friendlySpentTime($metrics['totals']['time']);
        $metrics['totals']['spent'] = number_format($metrics['totals']['spent'], 2);
        return $metrics;
    }
}
