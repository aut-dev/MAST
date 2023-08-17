<?php

namespace Plugins\Tasks\controllers;

use Plugins\Tasks\helpers\TimeHelper;
use Plugins\Timer\Timer;
use craft\elements\Entry;
use craft\helpers\DateTimeHelper;
use craft\web\Controller;
use yii\web\ForbiddenHttpException;

class TasksController extends Controller
{
    /**
     * Poll progress of all a user's tasks
     * Get the current user tasks
     */
    public function actionGet()
    {
        $user = \Craft::$app->user->identity;
        $tasks = Entry::find()->section('task')->authorId($user->id)->orderBy('order asc');
        if ($id = $this->request->getQueryParam('id')) {
            $tasks->id($id);
        }
        $out = [];
        foreach ($tasks->all() as $task) {
            $out[] = $this->getTaskData($task);
        }
        return $this->asJson($out);
    }

    /**
     * Reorder tasks
     */
    public function actionReorder()
    {
        $this->requirePostRequest();
        $data = $this->request->getRequiredParam('data');
        foreach ($data as $data) {
            $task = Entry::find()->section('task')->authorId(\Craft::$app->user->identity->id)->id($data['id'])->one();
            if ($task) {
                $task->setFieldValue('order', $data['order']);
                \Craft::$app->elements->saveElement($task, false);
            }
        }
        return $this->asJson([]);
    }

    /**
     * Check if editing a task could make them derail instantly
     */
    public function actionCheckEditTask()
    {
        $this->requirePostRequest();
        $task = Entry::find()->id($this->request->getRequiredParam('entryId'))->one();
        $task->setFieldValuesFromRequest('fields');
        $daily = $task->getDailyTask();
        if ($daily) {
            $daily->setFieldValues([
                'taskType' => $task->taskType,
                'deadline' => $task->deadline,
                'length' => $task->getDuration(),
                'committed' => $task->committed,
                'paused' => $task->paused
            ]);
        }
        return $this->asJson([
            'derailed' => $daily ? $daily->hasDerailed() : false
        ]);
    }

    /**
     * Get a task data for refreshing purposes
     *
     * @param  Entry  $task
     * @return array
     */
    protected function getTaskData(Entry $task): array
    {
        $daily = $task->getDailyTask();
        $started = Timer::$plugin->timer->timerStarted($task);
        $length = $daily ? $daily->length : 0;
        return [
            'title' => $task->title,
            'id' => $task->id,
            'dailyId' => $daily ? $daily->id : null,
            'url' => $task->url,
            'timeBased' => $task->timeBased,
            'progressPerSec' => ($length > 0 ? (1 / $length * 100) : 0),
            'taskType' => $task->taskType->value,
            'committed' => $task->committed->getAmount() / 100,
            'countdown' => TimeHelper::minutesToNow($task->todayDeadline),
            'length' => ($daily and $daily->isActive()) ? round($daily->length / 60) : round($task->length / 60),
            'active' => $daily and $daily->isActive(),
            'complete' => $daily and $daily->isComplete(),
            'derailed' => $daily and $daily->hasDerailed(),
            'progress' => $daily ? $daily->getProgress() : false,
            'timerStarted' => $started ? $started->getTimestamp() : 0,
            'paused' => $task->paused,
            'deadline' => $daily ? $daily->deadlineInstance->getTimestamp() : null,
            'backgroundColor' => $task->backgroundColor ? (string)$task->backgroundColor : null
        ];
    }
}
