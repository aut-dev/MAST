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
    protected function getTasks(User $user, array $filters): array
    {
        $query = Entry::find()->authorId($user->id)->section('task');
        if ($filters['allTasks'] ?? false) {
            return $query->all();
        }
        return $query->id($filters['tasks'] ?? [])->all();
    }

    protected function getGroupBy(array $filters): string
    {
        $groupBys = array_keys(Analytics::$plugin->analytics->getGroupBys());
        if (!in_array($filters['groupBy'] ?? '', $groupBys)) {
            throw new Exception("groupBy filter can only be one of : " . implode(', ', $groupBys));
        }
        return $filters['groupBy'];
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

    protected function getDates(User $user, array $filters): array
    {
        $range = $filters['dateRange'] ?? '';
        $dateRanges = array_keys(Analytics::$plugin->analytics->getDateRanges());
        if (!in_array($range, $dateRanges)) {
            throw new Exception("groupBy filter can only be one of : " . implode(', ', $dateRanges));
        }
        if ($range == 'custom') {
            $dateFrom = $filters['dateFrom'] ?? null;
            $dateTo = $filters['dateTo'] ?? null;
            if (!$dateFrom) {
                throw new Exception("dateFrom filter is required for custom date range");
            }
            if (!$dateTo) {
                throw new Exception("dateTo filter is required for custom date range");
            }
            $elems = explode('-', $dateFrom);
            $dateFrom = $user->getNow()->setDate($elems[0], $elems[1], $elems[2])->setTime(0, 0, 0);
            $elems = explode('-', $dateTo);
            $dateTo = $user->getNow()->setDate($elems[0], $elems[1], $elems[2])->setTime(23, 59, 59);
        } elseif ($range == 'thisWeek') {
            $dateTo = $user->getNow();
            $dateFrom = clone $dateTo;
            while ($dateFrom->format('N') != 1) {
                $dateFrom->sub(new DateInterval('P1D'));
            }
            $dateFrom->setTime(0, 0, 0);
        } elseif ($range == 'lastWeek') {
            $dateTo = $user->getNow()->sub(new DateInterval('P1D'));
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
            $dateTo = $user->getNow();
            $dateFrom = clone $dateTo;
            while ($dateFrom->format('j') != 1) {
                $dateFrom->sub(new DateInterval('P1D'));
            }
            $dateFrom->setTime(0, 0, 0);
        } elseif ($range == 'lastMonth') {
            $dateTo = $user->getNow();
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
            $dateTo = $user->getNow();
            $dateFrom = clone $dateTo;
            while ($dateFrom->format('d/m') != '01/01') {
                $dateFrom->sub(new DateInterval('P1D'));
            }
            $dateFrom->setTime(0, 0, 0);
        } elseif ($range == 'lastYear') {
            $dateTo = $user->getNow();
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
