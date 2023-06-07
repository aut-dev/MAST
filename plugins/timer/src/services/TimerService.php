<?php

namespace Plugins\Timer\services;

use DateTime;
use Exception;
use Plugins\Timesheets\Timesheets;
use craft\base\Component;
use craft\elements\Entry;

class TimerService extends Component
{
    public function start(int $taskId)
    {
        $user = \Craft::$app->user->identity;
        if ($user->timerStarted) {
            throw new Exception("Timer is already started");
        }
        $task = Entry::find()->id($taskId)->one();
        if ($task->isExpired) {
            throw new Exception("This task has expired");
        }
        $user->setFieldValues([
            'timerStarted' => $user->now,
            'timerTask' => [$taskId]
        ]);
        \Craft::$app->elements->saveElement($user, false);
    }

    public function stop(): Entry
    {
        $user = \Craft::$app->user->identity;
        if (!$user->timerStarted) {
            throw new Exception("Timer is not started");
        }
        $task = $user->timerTask->one();
        Timesheets::$plugin->timesheets->addTimesheet($task, $user->timerStarted, $user->now);
        $user->setFieldValues([
            'timerTask' => [],
            'timerStarted' => null
        ]);
        \Craft::$app->elements->saveElement($user, false);
        return Entry::find()->id($task->id)->one();
    }
}
