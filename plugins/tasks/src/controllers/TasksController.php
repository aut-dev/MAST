<?php

namespace Plugins\Tasks\controllers;

use craft\elements\Entry;
use craft\web\Controller;
use yii\web\ForbiddenHttpException;

class TasksController extends Controller
{
    public function actionStatus()
    {
        $id = $this->request->getRequiredParam('id');
        $user = \Craft::$app->user->identity;
        $task = Entry::find()->section('task')->authorId($user->id)->id($id)->one();
        if (!$task) {
            throw new ForbiddenHttpException('Task not found');
        }
        return $this->asJson([
            'status' => $task->getTaskStatus()
        ]);
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
