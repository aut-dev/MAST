<?php

namespace Plugins\Tasks\helpers;

use craft\db\Query;
use craft\helpers\Db;

class DateHelper
{
    public static function addDateParamsBetween(Query $query, \DateTime $start, \DateTime $end)
    {
        $dateField = 'content.field_startDate_' . \Craft::$app->fields->getFieldByHandle('startDate')->columnSuffix;
        $query->where(['between', $dateField, Db::prepareDateForDb($start), Db::prepareDateForDb($end)]);
    }

    public static function addDateParamsBiggerThan(Query $query, \DateTime $date, bool $strict = false)
    {
        $dateField = 'content.field_startDate_' . \Craft::$app->fields->getFieldByHandle('startDate')->columnSuffix;
        $query->where([$strict ? '>' : '>=', $dateField, Db::prepareDateForDb($date)]);
    }

    public static function addDateParamsSmallerThan(Query $query, \DateTime $date, bool $strict = false)
    {
        $dateField = 'content.field_startDate_' . \Craft::$app->fields->getFieldByHandle('startDate')->columnSuffix;
        $query->where([$strict ? '<' : '<=', $dateField, Db::prepareDateForDb($date)]);
    }

    public static function addDateParamsEquals(Query $query, \DateTime $date)
    {
        $dateField = 'content.field_startDate_' . \Craft::$app->fields->getFieldByHandle('startDate')->columnSuffix;
        $query->where(['=', $dateField, Db::prepareDateForDb($date)]);
    }
}
