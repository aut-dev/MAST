<?php

namespace Plugins\Timer\controllers;

use DateTime;
use Exception;
use Illuminate\Support\Collection;
use Plugins\Timer\Timer;
use craft\elements\Entry;
use craft\web\Controller;

class TimerController extends Controller
{
    public function actionStart()
    {
        $taskId = $this->request->getRequiredParam('taskId');
        $user = \Craft::$app->user->identity;
        $task = Entry::find()->section('task')->id($taskId)->authorId($user->id)->one();
        $started = null;
        if ($timestamp = $this->request->getParam('started')) {
            $started = $user->getDate((new DateTime())->setTimestamp($timestamp));
        }
        $started = Timer::$plugin->timer->start($task, $started);
        return $this->asJson([
            'started' => $started->getTimestamp()
        ]);
    }

    public function actionStop()
    {
        $taskId = $this->request->getRequiredParam('taskId');
        $user = \Craft::$app->user->identity;
        $task = Entry::find()->section('task')->id($taskId)->authorId($user->id)->one();
        $stopped = null;
        if ($timestamp = $this->request->getParam('stopped')) {
            $stopped = $user->getDate((new DateTime())->setTimestamp($timestamp));
        }
        Timer::$plugin->timer->stop($task, $stopped);
        return $this->asJson([
            'progress' => $task->getDailyTask() ? $task->getDailyTask()->getProgress(true) : false
        ]);
    }
}
