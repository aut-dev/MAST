<?php

namespace Plugins\Tasks\services;

use DateTime;
use DateTimeZone;
use Plugins\Tasks\Tasks;
use craft\base\Component;
use craft\elements\Entry;
use craft\elements\User;

class UsersService extends Component
{
    /**
     * Change timezone of all tasks start dates if a user changes their timezone
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
                $date = (clone $task->startDate)
                    ->setTimezone(new DateTimeZone($user->timezone))
                    ->setDate($task->startDate->format('Y'), $task->startDate->format('m'), $task->startDate->format('d'))
                    ->setTime(0, 0, 0);
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
        }
    }
}
