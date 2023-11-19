<?php

namespace Plugins\Analytics\services;

use DateInterval;
use DateTime;
use Plugins\Tasks\helpers\DateHelper;
use craft\elements\Entry;
use craft\elements\User;
use craft\elements\db\EntryQuery;
use craft\helpers\MoneyHelper;

class MoneySpentDataService extends DataService
{
    protected function processData(array $dailys, array &$data)
    {
        foreach ($dailys as $daily) {
            $task = $daily->task->first();
            if (!isset($data[$task->id])) {
                $data[$task->id] = 0;
            }
            $data[$task->id] += MoneyHelper::toNumber($daily->committed);
        }
    }

    protected function processLineData(array $dailys, array &$data, string $groupBy)
    {
        foreach ($dailys as $daily) {
            $index = $this->getGroupByIndex($daily->startDate, $groupBy);
            $task = $daily->task->first();
            if (!isset($data[$task->id][$index])) {
                $data[$task->id][$index] = 0;
            }
            $data[$task->id][$index] += MoneyHelper::toNumber($daily->committed);
        }
    }

    protected function _query(array $tasks, DateTime $dateFrom, DateTime $dateTo): EntryQuery
    {
        $dailys = Entry::find()->section('dailyTask')->chargeSucceeded(true)->with('task')->relatedTo($tasks)->orderBy('startDate asc');
        DateHelper::addDateParamsBetween($dailys, $dateFrom, $dateTo);
        return $dailys;
    }
}
