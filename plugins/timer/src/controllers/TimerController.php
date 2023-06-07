<?php

namespace Plugins\Timer\controllers;

use DateTime;
use Exception;
use Plugins\Timer\Timer;
use craft\web\Controller;

class TimerController extends Controller
{
    public function actionStart()
    {
        $taskId = $this->request->getRequiredParam('taskId');
        try {
            Timer::$plugin->timer->start($taskId);
        } catch (\Exception $e) {
            $this->response->setStatusCode(400);
            return $this->asJson(['error' => $e->getMessage()]);
        }
        return $this->asJson([
            'current' => \Craft::$app->view->renderTemplate('_includes/current-timer')
        ]);
    }

    public function actionStop()
    {
        try {
            $task = Timer::$plugin->timer->stop();
        } catch (\Exception $e) {
            $this->response->setStatusCode(400);
            return $this->asJson(['error' => $e->getMessage()]);
        }
        return $this->asJson([
            'complete' => $task->isComplete,
            'taskId' => $task->id
        ]);
    }

    public function actionPollProgress()
    {
        $user = \Craft::$app->user->identity;
        $task = $user->timerTask->one();
        if (!$task) {
            return $this->asJson([
                'running' => false
            ]);
        }
        $time = $task->timeSpent + $user->getTimerSpent($task);
        return $this->asJson([
            'running' => true,
            'taskId' => $task->id,
            'time' => $time,
            'percent' => $time / $task->length * 100
        ]);
    }
}
