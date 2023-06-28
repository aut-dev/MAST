<?php

namespace Plugins\Tasks\helpers;

use craft\db\Query;
use craft\helpers\Db;
use DateTime;

class DateHelper
{
    public static function addDateParamsBetween(Query $query, \DateTime $start, \DateTime $end, string $field = 'startDate')
    {
        $dateField = 'content.field_' . $field . '_' . \Craft::$app->fields->getFieldByHandle($field)->columnSuffix;
        $query->where(['between', $dateField, Db::prepareDateForDb($start), Db::prepareDateForDb($end)]);
    }

    public static function addDateParamsBiggerThan(Query $query, \DateTime $date, string $field = 'startDate', bool $strict = false)
    {
        $dateField = 'content.field_' . $field . '_' . \Craft::$app->fields->getFieldByHandle($field)->columnSuffix;
        $query->where([$strict ? '>' : '>=', $dateField, Db::prepareDateForDb($date)]);
    }

    public static function addDateParamsSmallerThan(Query $query, \DateTime $date, string $field = 'startDate', bool $strict = false)
    {
        $dateField = 'content.field_' . $field . '_' . \Craft::$app->fields->getFieldByHandle($field)->columnSuffix;
        $query->where([$strict ? '<' : '<=', $dateField, Db::prepareDateForDb($date)]);
    }

    public static function addDateParamsEquals(Query $query, \DateTime $date, string $field = 'startDate')
    {
        $dateField = 'content.field_' . $field . '_' . \Craft::$app->fields->getFieldByHandle($field)->columnSuffix;
        $query->where(['=', $dateField, Db::prepareDateForDb($date)]);
    }

    public static function isSameDay(DateTime $day1, DateTime $day2): bool
    {
        return $day1->format('Y-m-d') == $day2->format('Y-m-d');
    }
}
