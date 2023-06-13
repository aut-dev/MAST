<?php

namespace Plugins\Timer\controllers;

use DateTime;
use Exception;
use Illuminate\Support\Collection;
use Plugins\Timer\Timer;
use craft\web\Controller;

class TimerController extends Controller
{
    public function actionStart()
    {
        $taskId = $this->request->getRequiredParam('taskId');
        $user = \Craft::$app->user->identity;
        Timer::$plugin->timer->start($taskId, $user);
        return $this->asJson([]);
    }

    public function actionStop()
    {
        $taskId = $this->request->getRequiredParam('taskId');
        $user = \Craft::$app->user->identity;
        Timer::$plugin->timer->stop($taskId, $user);
        return $this->asJson([]);
    }

    public function actionPollProgress()
    {
        $user = \Craft::$app->user->identity;
        $timer = $user->timer instanceof Collection ? $user->timer : $user->timer->with('timer:task')->all();
        $progress = [];
        foreach ($timer as $block) {
            $task = $block->task[0];
            $time = $task->getTimeSpent();
            $progress[$task->id] = [
                'time' => $time,
                'percent' => $task->getTodayDuration() ? $time / $task->getTodayDuration() * 100 : 0
            ];
        }
        return $this->asJson($progress);
    }
}
