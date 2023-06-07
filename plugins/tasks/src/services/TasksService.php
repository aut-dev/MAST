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

class TasksService extends Component
{
    public function getTodaysTasks(User $user): array
    {
        $query = Entry::find()->section('scheduledTask')->with('task')->authorId($user->id);
        DateHelper::addDateParamsBetween($query, $user->today, $user->endOfToday);
        return $query->all();
    }

    /**
     * Schedule all tasks
     *
     * @return int
     */
    public function scheduleTasks(): int
    {
        $now = DateTimeHelper::toDateTime('now');
        $total = 0;
        $tasks = Entry::find()->section('task')->with('weeks');
        DateHelper::addDateParamsSmallerThan($tasks, $now);
        foreach ($tasks->all() as $task) {
            if ($this->scheduleTask($task)) {
                $total++;
            }
        }
        return $total;
    }

    /**
     * Schedule a task, will check if the task is already scheduled for that day
     *
     * @return ?Entry
     */
    public function scheduleTask(Entry $task): ?Entry
    {
        $today = $task->author->today;
        $query = Entry::find()->section('scheduledTask')->relatedTo($task)->authorId($task->authorId);
        DateHelper::addDateParamsEquals($query, $today);
        if ($query->count()) {
            return null;
        }
        $week = $this->findWeek($task, $today);
        $day = strtolower($today->format('D'));
        $length = $week[$day];
        if (!$length) {
            return null;
        }
        $section = \Craft::$app->sections->getSectionByHandle('scheduledTask');
        $types = $section->entryTypes;
        $type = reset($types);
        $scheduled = new Entry([
            'sectionId' => $section->id,
            'typeId' => $type->id,
            'authorId' => $task->authorId
        ]);
        $end = (clone $today)->setTime($task->deadline->format('H'), $task->deadline->format('i'), 59);
        $scheduled->setFieldValues([
            'task' => [$task->id],
            'startDate' => $today,
            'endDate' => $end,
            'length' => $task->length * $length
        ]);
        if (\Craft::$app->elements->saveElement($scheduled)) {
            return $scheduled;
        }
        return null;
    }

    public function checkDerails(): int
    {
        $now = DateTimeHelper::toDateTime('now');
        $query = Entry::find()->section('scheduledTask')->with('task')->chargeAttempted(false)->isComplete(false);
        DateHelper::addDateParamsSmallerThan($query, $now, 'endDate');
        $total = 0;
        foreach ($query->all() as $task) {
            $this->taskHasDerailed($task);
            $total++;
        }
        return $total;
    }

    /**
     * Callback when a task is created, will schedule it if the start date is today
     */
    public function onTaskCreated(Entry $task)
    {
        if ($task->startDate >= $task->author->today and $task->startDate <= $task->author->endOfToday) {
            $this->scheduleTask($task, $task->startDate);
        }
    }

    /**
     * Disable all scheduled task when a task is disabled
     *
     * @param  Entry  $task
     */
    public function beforeSavingTask(Entry $task)
    {
        if ($task->enabled) {
            return;
        }
        $old = Entry::find()->section('task')->id($task->id)->one();
        if (!$old) {
            return;
        }
        $scheduled = Entry::find()->section('scheduledTask')->relatedTo($task)->all();
        foreach ($scheduled as $scheduled) {
            $scheduled->enabled = false;
            \Craft::$app->elements->saveElement($scheduled, false);
        }
    }

    protected function taskHasDerailed(Entry $task)
    {
        $task->setFieldValue('chargeAttempted', true);
        if (Stripe::$plugin->stripe->chargeForDerail($task)) {
            $amount = MoneyHelper::toNumber($task->task[0]->committed);
            $email = \Craft::$app->mailer->composeFromKey('charged_for_derail', [
                'task' => $task,
                'amount' => $amount
            ]);
            $email->setTo($task->author->email)->send();
        }
        \Craft::$app->elements->saveElement($task, false);
    }

    protected function findWeek(Entry $task, \DateTime $end)
    {
        $start = $task->startDate;
        $current = 0;
        $weeks = $task->weeks instanceof Collection ? $task->weeks : $task->weeks->all();
        $max = sizeof($weeks);
        while ($start < $end) {
            $current++;
            if ($current >= $max) {
                $current = 0;
            }
            $start->add(new DateInterval('P7D'));
        }
        return $weeks[$current];
    }
}
