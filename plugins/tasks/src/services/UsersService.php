<?php

namespace Plugins\Tasks\services;

use craft\base\Component;
use craft\elements\Entry;
use craft\elements\User;
use DateTimeZone;

class UsersService extends Component
{
    /**
     * Change timezone of all tasks and scheduled tasks if a user changes their timezone
     *
     * @param User $user
     */
    public function beforeSavingUser(User $user)
    {
        $old = User::find()->id($user->id)->one();
        if ($old->timezone and $user->timezone and $user->timezone != $old->timezone) {
            $tasks = Entry::find()->section('task')->anyStatus()->all();
            foreach ($tasks as $task) {
                $date = (clone $task->startDate)->setTimezone(new DateTimeZone($user->timezone))->setTime(0, 0, 0);
                $task->startDate = $date;
                \Craft::$app->elements->saveElement($task, false);
            }
            $tasks = Entry::find()->section('scheduledTask')->anyStatus()->all();
            foreach ($tasks as $task) {
                $date = (clone $task->startDate)->setTimezone(new DateTimeZone($user->timezone))->setTime(0, 0, 0);
                $task->startDate = $date;
                \Craft::$app->elements->saveElement($task, false);
            }
        }
    }
}
