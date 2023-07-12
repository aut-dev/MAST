<?php

namespace Plugins\Tasks\controllers;

use craft\elements\Entry;
use craft\helpers\DateTimeHelper;
use craft\web\Controller;
use yii\web\ForbiddenHttpException;

class TasksController extends Controller
{
    public function actionPoll()
    {
        $user = \Craft::$app->user->identity;
        $tasks = Entry::find()->section('task')->authorId($user->id)->all();
        $out = [];
        foreach ($tasks as $task) {
            $daily = $task->getDailyTask();
            $deadline = 'today at ' . $task->todayDeadline->format('H:i');
            if ($daily and $daily->isExpired()) {
                $deadline = $task->nextDeadline->format('d/m/Y H:i');
            }
            $out[$task->id] = [
                'deadline' => $deadline,
                'active' => $daily and $daily->isActive(),
                'status' => $task->getTaskStatus(),
                'progress' => $daily ? $daily->getProgress(true) : false
            ];
        }
        return $this->asJson($out);
    }

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
                'committed' => $task->committed
            ]);
        }
        return $this->asJson([
            'status' => $daily ? $daily->getTaskStatus() : 'inactive'
        ]);
    }
}
