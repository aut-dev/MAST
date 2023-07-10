<?php

namespace Plugins\Tasks\controllers;

use craft\elements\Entry;
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
}
