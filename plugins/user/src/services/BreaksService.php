<?php

namespace Plugins\Users\services;

use DateTime;
use Plugins\Tasks\helpers\DateHelper;
use craft\base\Component;
use craft\elements\Entry;
use craft\elements\User;

class BreaksService extends Component
{
    /**
     * Extra break validation rules
     *
     * @param  Entry  $break
     */
    public function validateBreak(Entry $break)
    {
        if ($break->startDate and $break->endDate and $break->startDate > $break->endDate) {
            $break->addError('startDate', \Craft::t('site', 'Start date must be before end date'));
        }
    }

    /**
     * Is a user on break for a given day
     *
     * @param  User     $user
     * @param  DateTime $day
     * @return boolean
     */
    public function isOnBreak(User $user, DateTime $day): bool
    {
        $day->setTime(0, 0, 0);
        $breaks = Entry::find()->section('break')->authorId($user->id);
        DateHelper::addDateParamsSmallerThan($breaks, $day, 'startDate');
        DateHelper::addDateParamsBiggerThan($breaks, $day, 'endDate');
        return $breaks->count() > 0;
    }
}
