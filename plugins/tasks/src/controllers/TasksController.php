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
     * (Un)Pauses a task
     */
    public function actionPause()
    {
        $user = \Craft::$app->user->identity;
        $paused = $this->request->getRequiredParam('paused');
        $task = Entry::find()->section('task')->authorId($user->id)->id($this->request->getRequiredParam('id'))->one();
        if (!$task) {
            throw new ForbiddenHttpException('Task not found');
        }
        $task->setFieldValue('paused', $paused);
        \Craft::$app->elements->saveElement($task, false);
        return $this->asJson($this->getTaskData($task));
    }

    /**
     * (Un)Mark a one off task as done
     */
    public function actionDone()
    {
        $user = \Craft::$app->user->identity;
        $done = $this->request->getRequiredParam('done');
        $task = Entry::find()->section('task')->authorId($user->id)->id($this->request->getRequiredParam('id'))->taskType('oneOff')->one();
        if (!$task) {
            throw new ForbiddenHttpException('Task not found');
        }
        $task->setFieldValue('done', $done);
        \Craft::$app->elements->saveElement($task, false);
        return $this->asJson($this->getTaskData($task));
    }

    /**
     * Poll progress of all a user's tasks
     */
    public function actionPoll()
    {
        $user = \Craft::$app->user->identity;
        $tasks = Entry::find()->section('task')->authorId($user->id);
        if ($id = $this->request->getQueryParam('id')) {
            $tasks->id($id);
        }
        $out = [];
        foreach ($tasks->all() as $task) {
            $out[$task->id] = $this->getTaskData($task);
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
            'status' => $daily ? $daily->getTaskStatus() : 'inactive'
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
        return [
            'countdown' => TimeHelper::minutesToNow($task->todayDeadline),
            'active' => $daily and $daily->isActive(),
            'status' => $task->getTaskStatus(),
            'progress' => $daily ? $daily->getProgress(true) : false,
            'timerStarted' => $started ? true : false,
            'backgroundColor' => $task->backgroundColor ? (string)$task->backgroundColor : null
        ];
    }
}
