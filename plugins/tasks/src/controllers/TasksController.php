<?php

namespace Plugins\Tasks\controllers;

use Plugins\Tasks\Tasks;
use Plugins\Tasks\helpers\TimeHelper;
use Plugins\Timer\Timer;
use craft\elements\Entry;
use craft\helpers\DateTimeHelper;
use craft\web\Controller;
use DateInterval;

class TasksController extends Controller
{
    /**
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
     * Check if editing a task could make them derail instantly,
     * Create an unsaved daily task and check if it has derailed
     */
    public function actionCheckEditTask()
    {
        $this->requirePostRequest();
        $task = Entry::find()->id($this->request->getRequiredParam('entryId'))->one();
        $task->setFieldValuesFromRequest('fields');
        $service = Tasks::$plugin->tasks;
        $daily = false;
        if ($service->dayHasDailyTask($task)) {
            $daily = $service->createDailyTask($task, $task->author->today, false);
        }
        return $this->asJson([
            'derailed' => $daily ? (!$daily->isPaused() and $daily->hasDerailed()) : false
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
            'url' => $task->url,
            'timeBased' => $task->timeBased,
            'progressPerSec' => ($length > 0 ? (1 / $length * 100) : 0),
            'taskType' => $task->taskType->value,
            'committed' => $task->committed->getAmount() / 100,
            'length' => $daily ? round($daily->length / 60) : round($task->length / 60),
            'timerStarted' => $started ? $started->getTimestamp() : 0,
            'paused' => $task->paused,
            'backgroundColor' => $task->backgroundColor ? (string)$task->backgroundColor : null,
            'daily' => $daily ? [
                'active' => true,
                'id' => $daily->id,
                'complete' => $daily->isComplete(),
                'derailed' => $daily->hasDerailed(),
                'progress' => $daily->getProgress(),
                'day' => substr($task->author->today->format('l'), 0, 1),
                'deadline' => $daily->deadlineInstance->getTimestamp(),
                'countdown' => $daily ? TimeHelper::minutesToNow($daily->deadlineInstance) : null,
            ] : [
                'active' => false,
                'day' => substr($task->author->today->format('l'), 0, 1)
            ]
        ];
    }
}
