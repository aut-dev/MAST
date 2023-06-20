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
                $this->taskHasDerailed($task);
                $total++;
            }
        }
        return $total;
    }

    /**
     * Has a task derailed, will return false if there's already a derail saved for that task
     *
     * @param  Entry   $task
     * @return boolean
     */
    protected function hasTaskDerailed(Entry $task): bool
    {
        if (!$task->isDerailed) {
            return false;
        }
        $derail = Entry::find()->section('derail')->relatedTo($task);
        DateHelper::addDateParamsBetween($derail, $task->yesterdayDeadline, $task->todayDeadline);
        if ($derail->one()) {
            return false;
        }
        return true;
    }

    /**
     * Actions when a task has derailed, will create a derail entry and charge the user
     *
     * @param  Entry  $task
     */
    protected function taskHasDerailed(Entry $task)
    {
        $chargeSucceeded = false;
        $amount = MoneyHelper::toNumber($task->committed);
        if ($amount > 0) {
            $chargeSucceeded = Stripe::$plugin->stripe->chargeForDerail($task);
        }
        $this->createDerail($task, $chargeSucceeded, $amount);
        $email = \Craft::$app->mailer->composeFromKey('charged_for_derail', [
            'task' => $task,
            'amount' => $amount
        ]);
        $email->setTo($task->author->email)->send();
    }

    /**
     * Create a derail entry
     *
     * @param  Entry  $task
     * @param  bool   $chargeSucceeded
     * @return ?Entry
     */
    protected function createDerail(Entry $task, bool $chargeSucceeded): ?Entry
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
            'startDate' => $task->author->now,
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
