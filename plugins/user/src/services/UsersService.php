<?php

namespace Plugins\Users\services;

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
     *
     * @param User $user
     */
    public function beforeSavingUser(User $user)
    {
        $old = User::find()->id($user->id)->one();
        if ($old->timezone and $user->timezone and $user->timezone != $old->timezone) {
            $tasks = Entry::find()->section('task')->authorId($user->id)->anyStatus()->all();
            $today = $user->today;
            $oldToday = (new DateTime())->setTimezone(new DateTimeZone($old->timezone))->setTime(0, 0, 0);
            foreach ($tasks as $task) {
                $date = $this->cloneDate($task->startDate, $user);
                $daily = Tasks::$plugin->tasks->getDailyTask($task, $oldToday);
                $task->setFieldValue('startDate', $date);
                \Craft::$app->elements->saveElement($task, false);
                if ($daily and !$daily->processed) {
                    $daily->setFieldValues([
                        'startDate' => $today,
                        'length' => $task->getDuration($today)
                    ]);
                    \Craft::$app->elements->saveElement($daily, false);
                }
            }
            if ($user->unlimitedBreakStart) {
                $date = $this->cloneDate($user->unlimitedBreakStart, $user);
                $user->setFieldValue('unlimitedBreakStart', $date);
                \Craft::$app->elements->saveElement($user, false);
            }
        }
    }

    protected function cloneDate(DateTime $date, User $user): DateTime
    {
        return (clone $date)
            ->setTimezone(new DateTimeZone($user->timezone))
            ->setDate($date->format('Y'), $date->format('m'), $date->format('d'))
            ->setTime(0, 0, 0);
    }
}
