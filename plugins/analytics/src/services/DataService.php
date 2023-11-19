<?php

namespace Plugins\Analytics\services;

use DateInterval;
use DateTime;
use Exception;
use Plugins\Analytics\Analytics;
use craft\base\Component;
use craft\elements\Entry;
use craft\elements\User;

class DataService extends Component
{
    protected $user;
    protected $filters;

    public function forPie(User $user, array $filters)
    {
        $this->beforeProcess($user, $filters);
        $tasks = $this->getTasks();
        list($dateFrom, $dateTo) = $this->getDates();
        $query = $this->_query($tasks, $dateFrom, $dateTo);
        $data = [];
        $this->processData($query->all(), $data);
        $colors = $labels = $dataset = [];
        foreach ($tasks as $task) {
            $dataset[] = $data[$task->id] ?? 0;
            $labels[] = $task->title;
            $colors[] = (string)$task->color;
        }
        return [
            'labels' => $labels,
            'datasets' => [[
                'data' => $dataset,
                'label' => 'Total',
                'backgroundColor' => $colors
            ]]
        ];
    }

    public function forPolarArea(User $user, array $filters): array
    {
        $this->beforeProcess($user, $filters);
        $tasks = $this->getTasks();
        list($dateFrom, $dateTo) = $this->getDates();
        $query = $this->_query($tasks, $dateFrom, $dateTo);
        $data = $labels = [];
        $this->processData($query->all(), $data);
        $datasets[0] = [
            'data' => [],
            'backgroundColor' => [],
            'label' => 'Total'
        ];
        foreach ($tasks as $task) {
            $labels[] = $task->title;
            $datasets[0]['data'][] = $data[$task->id] ?? 0;
            $datasets[0]['backgroundColor'][] = 'rgba(' . $task->color->getR() . ',' . $task->color->getG() . ',' . $task->color->getB() . ',0.5)';
        }
        return [
            'labels' => $labels,
            'datasets' => $datasets
        ];
    }

    public function forBar(User $user, array $filters): array
    {
        if (!($filters['cumulative'] ?? false)) {
            $data = $this->forLine($user, $filters);
            foreach ($data['datasets'] as &$set) {
                $set['backgroundColor'] = $set['borderColor'];
            }
            return $data;
        }
        $this->beforeProcess($user, $filters);
        $tasks = $this->getTasks();
        list($dateFrom, $dateTo) = $this->getDates();
        $query = $this->_query($tasks, $dateFrom, $dateTo);
        $data = $labels = [];
        $this->processData($query->all(), $data);
        $datasets[0] = [
            'data' => [],
            'label' => 'Total',
            'backgroundColor' => [],
        ];
        foreach ($tasks as $task) {
            $labels[] = $task->title;
            $datasets[0]['data'][] = $data[$task->id] ?? 0;
            $datasets[0]['backgroundColor'][] = (string)$task->color;
        }
        return [
            'labels' => $labels,
            'datasets' => $datasets
        ];
    }

    public function forLine(User $user, array $filters): array
    {
        $this->beforeProcess($user, $filters);
        $groupBy = $this->getGroupBy();
        $cumulative = $filters['cumulative'] ?? false;
        $tasks = $this->getTasks();
        list($dateFrom, $dateTo) = $this->getDates();
        $query = $this->_query($tasks, $dateFrom, $dateTo);
        $datasets = $labels = $data = [];
        $this->processLineData($query->all(), $data, $groupBy);
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

    protected function beforeProcess(User $user, array $filters)
    {
        $this->user = $user;
        $this->filters = $filters;
    }

    protected function getTasks(): array
    {
        $query = Entry::find()->authorId($this->user->id)->section('task');
        if ($this->filters['allTasks'] ?? false) {
            return $query->all();
        }
        return $query->id($this->filters['tasks'] ?? [])->all();
    }

    protected function getGroupBy(): string
    {
        $groupBys = array_keys(Analytics::$plugin->analytics->getChartFieldOptions('groupBy'));
        if (!in_array($this->filters['groupBy'] ?? '', $groupBys)) {
            throw new Exception("groupBy filter can only be one of : " . implode(', ', $groupBys));
        }
        return $this->filters['groupBy'];
    }

    protected function getGroupByIndex(DateTime $date, string $groupBy): string
    {
        switch ($groupBy) {
            case 'days':
                return $date->format('Y/m/d');
            case 'months':
                return $date->format('Y/m');
        }
        throw new Exception("Group by $groupBy has not been implemented yet");
    }

    protected function getGroupByLabel(DateTime $date, string $groupBy): string
    {
        switch ($groupBy) {
            case 'days':
                return $date->format('d M Y');
            case 'months':
                return $date->format('M Y');
        }
        throw new Exception("Group by $groupBy has not been implemented yet");
    }

    protected function getDates(): array
    {
        $range = $this->filters['dateRange'] ?? '';
        $dateRanges = array_keys(Analytics::$plugin->analytics->getChartFieldOptions('dateRange'));
        if (!in_array($range, $dateRanges)) {
            throw new Exception("groupBy filter can only be one of : " . implode(', ', $dateRanges));
        }
        if ($range == 'custom') {
            $dateFrom = $this->filters['dateFrom'] ?? null;
            $dateTo = $this->filters['dateTo'] ?? null;
            if (!$dateFrom) {
                throw new Exception("dateFrom filter is required for custom date range");
            }
            if (!$dateTo) {
                throw new Exception("dateTo filter is required for custom date range");
            }
            $elems = explode('-', $dateFrom);
            $dateFrom = $this->user->getNow()->setDate($elems[0], $elems[1], $elems[2])->setTime(0, 0, 0);
            $elems = explode('-', $dateTo);
            $dateTo = $this->user->getNow()->setDate($elems[0], $elems[1], $elems[2])->setTime(23, 59, 59);
        } elseif ($range == 'thisWeek') {
            $dateTo = $this->user->getNow();
            $dateFrom = clone $dateTo;
            while ($dateFrom->format('N') != 1) {
                $dateFrom->sub(new DateInterval('P1D'));
            }
            $dateFrom->setTime(0, 0, 0);
        } elseif ($range == 'lastWeek') {
            $dateTo = $this->user->getNow()->sub(new DateInterval('P1D'));
            while ($dateTo->format('N') != 7) {
                $dateTo->sub(new DateInterval('P1D'));
            }
            $dateFrom = clone $dateTo;
            while ($dateFrom->format('N') != 1) {
                $dateFrom->sub(new DateInterval('P1D'));
            }
            $dateFrom->setTime(0, 0, 0);
            $dateTo->setTime(23, 59, 59);
        } elseif ($range == 'thisMonth') {
            $dateTo = $this->user->getNow();
            $dateFrom = clone $dateTo;
            while ($dateFrom->format('j') != 1) {
                $dateFrom->sub(new DateInterval('P1D'));
            }
            $dateFrom->setTime(0, 0, 0);
        } elseif ($range == 'lastMonth') {
            $dateTo = $this->user->getNow();
            $thisMonth = $dateTo->format('n');
            while ($dateTo->format('n') == $thisMonth) {
                $dateTo->sub(new DateInterval('P1D'));
            }
            $dateFrom = clone $dateTo;
            while ($dateFrom->format('j') != 1) {
                $dateFrom->sub(new DateInterval('P1D'));
            }
            $dateFrom->setTime(0, 0, 0);
            $dateTo->setTime(23, 59, 59);
        } elseif ($range == 'thisYear') {
            $dateTo = $this->user->getNow();
            $dateFrom = clone $dateTo;
            while ($dateFrom->format('d/m') != '01/01') {
                $dateFrom->sub(new DateInterval('P1D'));
            }
            $dateFrom->setTime(0, 0, 0);
        } elseif ($range == 'lastYear') {
            $dateTo = $this->user->getNow();
            $thisYear = $dateTo->format('Y');
            while ($dateTo->format('Y') == $thisYear) {
                $dateTo->sub(new DateInterval('P1D'));
            }
            $dateFrom = clone $dateTo;
            while ($dateFrom->format('d/m') != '01/01') {
                $dateFrom->sub(new DateInterval('P1D'));
            }
            $dateFrom->setTime(0, 0, 0);
            $dateTo->setTime(23, 59, 59);
        } else {
            throw new Exception("Date range $range has not been implemented yet");
        }
        return [$dateFrom, $dateTo];
    }
}
