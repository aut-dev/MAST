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
            $dayHasChanged = ($today->format('d-m-Y') != $oldToday->format('d-m-Y'));
            foreach ($tasks as $task) {
                if ($dayHasChanged) {
                    //Day has changed, need to delete the daily task and create it again or we could have duplicates or daily tasks that are in the future
                    $daily = Tasks::$plugin->tasks->getDailyTask($task, $oldToday);
                    if ($daily and !$daily->processed) {
                        \Craft::$app->elements->deleteElement($daily, true);
                        Tasks::$plugin->tasks->getOrCreateDailyTask($task, $today);
                    }
                }
                $date = (clone $task->startDate)
                    ->setTimezone(new DateTimeZone($user->timezone))
                    ->setDate($task->startDate->format('Y'), $task->startDate->format('m'), $task->startDate->format('d'))
                    ->setTime(0, 0, 0);
                $task->startDate = $date;
                \Craft::$app->elements->saveElement($task, false);
                if ($dayHasChanged) {
                    //Now we need to make sure the daily task is updated, the day has changed so the schedule could make the length different for the new day
                    $daily = Tasks::$plugin->tasks->getOrCreateDailyTask($task, $today);
                    if ($daily and !$daily->processed) {
                        $daily->setFieldValue('length', $task->getDuration($today));
                        \Craft::$app->elements->saveElement($daily, false);
                    }
                }
            }
        }
    }
}
