<?php

namespace Plugins\Tasks\services;

use DateInterval;
use DateTime;
use Plugins\Stripe\Stripe;
use Plugins\Tasks\helpers\DateHelper;
use craft\base\Component;
use craft\base\Element;
use craft\elements\Entry;
use craft\elements\User;
use craft\helpers\DateTimeHelper;
use craft\helpers\MoneyHelper;
use yii\base\InvalidArgumentException;
use Exception;

class TasksService extends Component
{
    /**
     * Check all tasks for derail, will charge users.
     * Returns the amount of derailed tasks
     *
     * @return int
     */
    public function checkDerails(): int
    {
        $tasks = Entry::find()->section('dailyTask')->processed(false)->all();
        $total = 0;
        foreach ($tasks as $task) {
            if ($this->hasTaskDerailed($task)) {
                $total++;
            }
        }
        return $total;
    }

    /**
     * Create daily tasks for all tasks
     */
    public function createDailyTasks()
    {
        $tasks = Entry::find()->section('task')->all();
        foreach ($tasks as $task) {
            $this->getOrCreateDailyTask($task);
        }
    }

    /**
     * Actions before a task is saved, need to update all daily task statuses
     *
     * @param  Entry  $task
     */
    public function beforeSavingTask(Entry $task)
    {
        $old = Entry::find()->section('task')->id($task->id)->anyStatus()->one();
        if ($old->enabled !== $task->enabled) {
            $dailys = Entry::find()->section('dailyTask')->anyStatus()->relatedTo($task)->all();
            foreach ($dailys as $daily) {
                $daily->enabled = $task->enabled;
                \Craft::$app->elements->saveElement($daily, false);
            }
        }
    }

    /**
     * Actions before a task is deleted, need to delete all daily tasks
     *
     * @param  Entry  $task
     * @param  bool   $hardDelete
     */
    public function beforeDeletingTask(Entry $task, bool $hardDelete)
    {
        $dailys = Entry::find()->section('dailyTask')->anyStatus()->relatedTo($task)->all();
        foreach ($dailys as $daily) {
            \Craft::$app->elements->deleteElement($daily, $hardDelete);
        }
    }

    /**
     * Actions after a task is saved, need to update today's daily task
     *
     * @param  Entry  $task
     */
    public function afterSavingTask(Entry $task, bool $isNew)
    {
        if (!$task->enabled) {
            return;
        }
        $daily = $this->getOrCreateDailyTask($task);
        if (!$isNew) {
            $daily->setFieldValues([
                'taskType' => $task->taskType,
                'deadline' => $task->deadline,
                'length' => $task->getDuration(),
                'committed' => $task->committed
            ]);
            \Craft::$app->elements->saveElement($daily);
        }
    }

    /**
     * Get or create a daily task for a task and a day, day will default to today if null
     *
     * @param  Entry  $task
     * @param  ?DateTime $day
     * @return Entry
     */
    public function getOrCreateDailyTask(Entry $task, ?DateTime $day = null): Entry
    {
        if ($day === null) {
            $day = $task->author->today;
        }
        $end = (clone $day)->setTime(23, 59, 59);
        $query = Entry::find()->section('dailyTask')->relatedTo($task);
        DateHelper::addDateParamsBetween($query, $day, $end);
        $daily = $query->one();
        if ($daily) {
            return $daily;
        }
        return $this->createDailyTask($task, $day);
    }

    /**
     * Has a task derailed, will only check if the daily task was for a different day than today.
     * Will charge the author if the task was derailed, and send an email if that charge failed.
     *
     * @param  Entry   $dailyTask
     * @return boolean
     */
    protected function hasTaskDerailed(Entry $dailyTask): bool
    {
        $now = $dailyTask->author->now;
        $date = $dailyTask->author->getDate($dailyTask->startDate);
        if ($now->format('Y-m-d') == $date->format('Y-m-d')) {
            return false;
        }
        //Do not derail tasks if subscription isn't active
        if ($dailyTask->author->subscriptionStatus == 'active' and $dailyTask->hasDerailed()) {
            $chargeSucceeded = false;
            $amount = MoneyHelper::toNumber($dailyTask->committed);
            if ($amount > 0) {
                $chargeSucceeded = Stripe::$plugin->stripe->chargeForDerail($dailyTask);
            }
            $email = \Craft::$app->mailer->composeFromKey('charged_for_derail', [
                'date' => $date->format('d/m/Y'),
                'task' => $dailyTask,
                'amount' => $amount,
                'chargeSucceeded' => $chargeSucceeded
            ]);
            $email->setTo($dailyTask->author->email)->send();
            $dailyTask->setFieldValues([
                'chargeSucceeded' => $chargeSucceeded,
                'hasDerailed' => true
            ]);
        }
        $dailyTask->setFieldValues([
            'processed' => true
        ]);
        \Craft::$app->elements->saveElement($dailyTask, false);
        return $dailyTask->hasDerailed;
    }

    /**
     * Create a daily task from a task
     *
     * @param  Entry    $task
     * @param  DateTime $day
     * @return Entry
     */
    protected function createDailyTask(Entry $task, DateTime $day): Entry
    {
        $section = \Craft::$app->sections->getSectionByHandle('dailyTask');
        $types = $section->entryTypes;
        $type = reset($types);
        $daily = new Entry([
            'sectionId' => $section->id,
            'typeId' => $type->id,
            'authorId' => $task->authorId,
        ]);
        $daily->setFieldValues([
            'task' => [$task->id],
            'startDate' => $day,
            'taskType' => $task->taskType,
            'deadline' => $task->deadline,
            'length' => $task->getDuration($day),
            'committed' => $task->committed
        ]);
        $daily->scenario = Element::SCENARIO_LIVE;
        if (!\Craft::$app->elements->saveElement($daily)) {
            throw new Exception("Couldn't save daily task : " . print_r($daily->errors, true));
        }
        return $daily;
    }
}
