<?php

namespace Plugins\Tasks\helpers;

use DateInterval;
use DateTime;

class TimeHelper
{
    /**
     * Turn a DateInterval into a friendly looking time eg 1y2m3d4h5s
     *
     * @param  DateInterval $diff
     * @return string
     */
    public static function friendlyDiffTime(DateInterval $diff): string
    {
        $friendly = '';
        if ($diff->y) {
            $friendly .= $diff->y . 'y';
        }
        if ($diff->m) {
            $friendly .= $diff->m . 'm';
        }
        if ($diff->d) {
            $friendly .= $diff->d . 'd';
        }
        if ($diff->h) {
            $friendly .= $diff->h . 'h';
        }
        if ($diff->i) {
            $friendly .= $diff->i . 'm';
        }
        return $friendly . $diff->s . 's';
    }

    /**
     * Turn an amount of seconds into a friendly looking time eg 1y2m3d4h5s
     *
     * @param  int    $seconds
     * @return string
     */
    public static function friendlySpentTime(int $seconds): string
    {
        $dtF = new DateTime('@0');
        $dtT = new DateTime("@$seconds");
        return static::friendlyDiffTime($dtF->diff($dtT));
    }

    /**
     * Count the amount of minutes from a date to now
     *
     * @param  DateTime $date
     * @return int
     */
    public static function minutesToNow(DateTime $date): int
    {
        $now = new DateTime();
        if ($date < $now) {
            return 0;
        }
        $diff = $now->diff($date);
        return $diff->d * 1440 + $diff->h * 60 + $diff->i + 1;
    }
}
