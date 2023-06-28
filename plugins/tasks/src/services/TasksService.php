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
    /**
     * Check all tasks for derail, will charge users.
     * Returns the amount of derailed tasks
     *
     * @return int
     */
    public function checkDerails(): int
    {
        $tasks = Entry::find()->section('task')->all();
        $total = 0;
        foreach ($tasks as $task) {
            if ($this->hasTaskDerailed($task)) {
                $total++;
            }
        }
        return $total;
    }

    /**
     * Has a task derailed, will return false if there's already a derail saved for that task.
     * If this was called at midnight, it would check derails for the day before
     *
     * @param  Entry   $task
     * @return boolean
     */
    protected function hasTaskDerailed(Entry $task): bool
    {
        $day = $task->author->now;
        $oneMinAgo = (clone $day)->sub(new DateInterval('PT1M'));
        if ($day->format('d') != $oneMinAgo->format('d')) {
            $day = $oneMinAgo;
            $day->setTime(23, 59, 59);
        }
        if (!$task->hasDerailed($day)) {
            return false;
        }
        $derail = Entry::find()->section('derail')->relatedTo($task);
        $start = (clone $day)->setTime(0, 0, 0);
        $end = (clone $day)->setTime(23, 59, 59);
        DateHelper::addDateParamsBetween($derail, $start, $end);
        if ($derail->one()) {
            return false;
        }
        $this->taskHasDerailed($task, $day);
        return true;
    }

    /**
     * Actions when a task has derailed, will create a derail entry and charge the user
     *
     * @param  Entry    $task
     * @param  DateTime $day
     */
    protected function taskHasDerailed(Entry $task, DateTime $day)
    {
        $chargeSucceeded = false;
        $amount = MoneyHelper::toNumber($task->committed);
        if ($amount > 0) {
            $chargeSucceeded = Stripe::$plugin->stripe->chargeForDerail($task);
        }
        $this->createDerail($task, $chargeSucceeded, $day);
        $email = \Craft::$app->mailer->composeFromKey('charged_for_derail', [
            'task' => $task,
            'amount' => $amount
        ]);
        $email->setTo($task->author->email)->send();
    }

    /**
     * Create a derail entry
     *
     * @param  Entry    $task
     * @param  bool     $chargeSucceeded
     * @param  DateTime $day
     * @return ?Entry
     */
    protected function createDerail(Entry $task, bool $chargeSucceeded, DateTime $day): ?Entry
    {
        $section = \Craft::$app->sections->getSectionByHandle('derail');
        $types = $section->entryTypes;
        $type = reset($types);
        $derail = new Entry([
            'sectionId' => $section->id,
            'typeId' => $type->id,
            'authorId' => $task->authorId,
        ]);
        $derail->setFieldValues([
            'task' => [$task->id],
            'startDate' => $day,
            'chargeSucceeded' => $chargeSucceeded,
            'charge' => $task->committed
        ]);
        $derail->scenario = Element::SCENARIO_LIVE;
        if (\Craft::$app->elements->saveElement($derail)) {
            return $derail;
        }
        return null;
    }
}
