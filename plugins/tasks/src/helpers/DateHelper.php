<?php

namespace Plugins\Tasks\helpers;

use craft\db\Query;
use craft\helpers\Db;
use DateTime;
use DateInterval;

class DateHelper
{
    /**
     * Adds the query parameter for a between 2 dates, will do it on the "startDate" field by default
     *
     * @param Query     $query
     * @param DateTime $start
     * @param DateTime $end
     * @param string    $field
     */
    public static function addDateParamsBetween(Query $query, DateTime $start, DateTime $end, string $field = 'startDate')
    {
        $dateField = 'content.field_' . $field . '_' . \Craft::$app->fields->getFieldByHandle($field)->columnSuffix;
        $query->andWhere(['between', $dateField, Db::prepareDateForDb($start), Db::prepareDateForDb($end)]);
    }

    /**
     * Considering a date from and date to, this adds the parameters to a query to be able to match anything between those dates
     * This only works for elements that have the "startDate" and "endDate" fields
     *
     * @param Query    $query
     * @param DateTime $start
     * @param DateTime $end
     * @param bool $strict
     */

    public static function add2DatesParamsBetween(Query $query, DateTime $start, DateTime $end, bool $strict = false)
    {
        $startDateField = 'content.field_startDate_' . \Craft::$app->fields->getFieldByHandle('startDate')->columnSuffix;
        $endDateField = 'content.field_endDate_' . \Craft::$app->fields->getFieldByHandle('endDate')->columnSuffix;
        $start = Db::prepareDateForDb($start);
        $end = Db::prepareDateForDb($end);
        $query->where(['between', $startDateField, $start, $end])
            ->orWhere(['between', $endDateField, $start, $end])
            ->orWhere(
                ['and', [
                        $strict ? '>' : '>=',
                        $startDateField,
                        $start
                    ],
                    [
                        $strict ? '<' : '<=',
                        $endDateField,
                        $end
                    ]
                ]
            );
    }

    public static function addDateParamsBiggerThan(Query $query, DateTime $date, string $field = 'startDate', bool $strict = false)
    {
        $dateField = 'content.field_' . $field . '_' . \Craft::$app->fields->getFieldByHandle($field)->columnSuffix;
        $query->andWhere([$strict ? '>' : '>=', $dateField, Db::prepareDateForDb($date)]);
    }

    public static function addDateParamsSmallerThan(Query $query, DateTime $date, string $field = 'startDate', bool $strict = false)
    {
        $dateField = 'content.field_' . $field . '_' . \Craft::$app->fields->getFieldByHandle($field)->columnSuffix;
        $query->andWhere([$strict ? '<' : '<=', $dateField, Db::prepareDateForDb($date)]);
    }

    public static function addDateParamsEquals(Query $query, DateTime $date, string $field = 'startDate')
    {
        $dateField = 'content.field_' . $field . '_' . \Craft::$app->fields->getFieldByHandle($field)->columnSuffix;
        $query->andWhere(['=', $dateField, Db::prepareDateForDb($date)]);
    }

    /**
     * Check if a date is the day before another date
     *
     * @param  DateTime $before
     * @param  DateTime $after
     * @return boolean
     */
    public static function isTheDayBefore(DateTime $before, DateTime $after): bool
    {
        $before = clone $before;
        $before->add(new DateInterval('P1D'));
        return ($before->format('d/m/D') == $after->format('d/m/D'));
    }
}
