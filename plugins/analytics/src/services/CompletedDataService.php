<?php

namespace Plugins\Analytics\services;

use DateTime;
use Plugins\Tasks\helpers\DateHelper;
use craft\elements\Entry;
use craft\elements\db\EntryQuery;

class CompletedDataService extends DerailsDataService
{
    protected function _query(array $tasks, DateTime $dateFrom, DateTime $dateTo): EntryQuery
    {
        $dailys = Entry::find()->section('dailyTask')->hasDerailed(false)->processed(true)->with('task')->relatedTo($tasks)->orderBy('startDate asc');
        DateHelper::addDateParamsBetween($dailys, $dateFrom, $dateTo);
        return $dailys;
    }
}
