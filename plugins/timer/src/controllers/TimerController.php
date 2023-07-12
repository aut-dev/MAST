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
        Timer::$plugin->timer->start($task);
        return $this->asJson([]);
    }

    public function actionStop()
    {
        $taskId = $this->request->getRequiredParam('taskId');
        $user = \Craft::$app->user->identity;
        $task = Entry::find()->section('task')->id($taskId)->authorId($user->id)->one();
        Timer::$plugin->timer->stop($task);
        return $this->asJson([
            'progress' => $task->getDailyTask() ? $task->getDailyTask()->getProgress(true) : false
        ]);
    }
}
