<?php

namespace Plugins\Users\services;

use DateTime;
use DateTimeZone;
use Plugins\Tasks\Tasks;
use craft\base\Component;
use craft\elements\Entry;
use craft\elements\User;

class UsersService extends Component
{
    /**
     * Extra user validation rules
     *
     * @param User $user
     */
    public function validateUser(User $user)
    {
        if ($user->timezone and !in_array($user->timezone, \DateTimeZone::listIdentifiers())) {
            $user->addError('timezone', \Craft::t('site', 'Timezone is not valid'));
        }
    }

    /**
     * Change timezone of several things if a user changes their timezone :
     * - all tasks start dates
     * - unlimited break start date
     * Also updates the daily task length, it could change if the new "today" is a different day
     *
     * @param User $user
     */
    public function beforeSavingUser(User $user)
    {
        $old = User::find()->id($user->id)->one();
        $today = $user->today;
        $oldToday = (new DateTime())->setTimezone(new DateTimeZone($old->timezone))->setTime(0, 0, 0);
        if ($user->timezone and $old->timezone and $old->timezone != $user->timezone) {
            $tasks = Entry::find()->section('task')->authorId($user->id)->anyStatus()->all();
            foreach ($tasks as $task) {
                $daily = Tasks::$plugin->tasks->getDailyTask($task, $oldToday);
                $task->setFieldValue('startDate', $this->cloneDate($task->startDate, $user));
                \Craft::$app->elements->saveElement($task, false);
                if ($daily) {
                    $daily->setFieldValues([
                        'startDate' => $today,
                        'length' => $task->getDuration($today)
                    ]);
                    \Craft::$app->elements->saveElement($daily, false);
                }
            }
            if ($user->unlimitedBreakStart) {
                $user->setFieldValue('unlimitedBreakStart', $this->cloneDate($user->unlimitedBreakStart, $user));
                \Craft::$app->elements->saveElement($user, false);
            }
        }
    }

    /**
     * Clone a date and make sure it's on the same day/time
     *
     * @param  DateTime $date
     * @param  User     $user
     * @return DateTime
     */
    protected function cloneDate(DateTime $date, User $user): DateTime
    {
        return (clone $date)
            ->setTimezone(new DateTimeZone($user->timezone))
            ->setDate($date->format('Y'), $date->format('m'), $date->format('d'))
            ->setTime(0, 0, 0);
    }
}
