<?php

namespace Plugins\Tasks\services;

use DateInterval;
use DateTime;
use Exception;
use Plugins\Stripe\Stripe;
use Plugins\Tasks\helpers\DateHelper;
use Plugins\Timer\Timer;
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
     * Tasks extra validation rules
     *
     * @param  Entry  $task
     */
    public function validateTask(Entry $task)
    {
        if ($task->color and $task->color->getLightness() > 95) {
            $task->addError('color', \Craft::t('site', 'This color is too bright'));
        }
        if ($task->backgroundColor and $task->backgroundColor->getLightness() < 10) {
            $task->addError('backgroundColor', \Craft::t('site', 'This color is too dark'));
        }
    }

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
     * Actions before a task is saved, stop the timer if task is archived
     *
     * @param  Entry  $task
     */
    public function beforeSavingTask(Entry $task)
    {
        if ($task->archive and Timer::$plugin->timer->timerStarted($task)) {
            Timer::$plugin->timer->stop($task, null, false);
        }
    }

    /**
     * Actions after a task is saved, need to update today's daily task or delete it if it's not meant to exist
     *
     * @param  Entry $task
     */
    public function afterSavingTask(Entry $task)
    {
        if ($daily = $this->getDailyTask($task)) {
            if ($this->dayHasDailyTask($task, $daily->startDate)) {
                $this->populateDailyTask($daily, $task);
                \Craft::$app->elements->saveElement($daily, false);
            } else {
                \Craft::$app->elements->deleteElement($daily, true);
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
        $dailys = Entry::find()->section('dailyTask')->trashed(null)->relatedTo($task)->all();
        foreach ($dailys as $daily) {
            \Craft::$app->elements->deleteElement($daily, $hardDelete);
        }
    }

    /**
     * Actions after a task is restored, need to restore all daily tasks
     *
     * @param  Entry  $task
     */
    public function afterRestoringTask(Entry $task)
    {
        $dailys = Entry::find()->section('dailyTask')->trashed(null)->relatedTo($task)->all();
        \Craft::$app->elements->restoreElements($dailys);
    }

    /**
     * Get the daily task for a task and a day, day will default to today if null
     *
     * @param  Entry  $task
     * @param  ?DateTime $day
     * @return ?Entry
     */
    public function getDailyTask(Entry $task, ?DateTime $day = null): ?Entry
    {
        if ($day === null) {
            $day = $task->author->today;
        }
        return Entry::find()->section('dailyTask')->relatedTo($task)->with('task')->startDate($day)->one();
    }

    /**
     * Get or create today's daily task for a task.
     * Will delete a daily task if it's not meant to exist.
     *
     * @param  Entry  $task
     * @return ?Entry
     */
    public function getOrCreateDailyTask(Entry $task): ?Entry
    {
        $day = $task->author->today;
        $daily = $this->getDailyTask($task, $day);
        if ($this->dayHasDailyTask($task, $day)) {
            return $daily ?: $this->createDailyTask($task, $day);
        }
        if ($daily and !$daily->processed) {
            \Craft::$app->elements->deleteElement($daily);
        }
        return null;
    }

    /**
     * Create a daily task for a specific day if the day needs one
     *
     * @param  Entry    $task
     * @param  DateTime $day
     * @return ?Entry
     */
    public function createDailyTaskIfNeeded(Entry $task, DateTime $day): ?Entry
    {
        if ($this->dayHasDailyTask($task, $day)) {
            return $this->createDailyTask($task, $day);
        }
        return null;
    }

    /**
     * Should there be a daily task for a day
     *
     * @param  Entry    $task
     * @param  DateTime $day
     * @return bool
     */
    protected function dayHasDailyTask(Entry $task, ?DateTime $day = null): bool
    {
        if ($day === null) {
            $day = $task->author->today;
        }
        if ($task->archive or DateHelper::isAfter($day, $task->startDate)) {
            return false;
        }
        if (!$task->recurring and !DateHelper::isSameDay($task->startDate, $day)) {
            return false;
        }
        return $task->getDuration($day) > 0;
    }

    /**
     * Create a daily task for a task and a day
     *
     * @param  Entry    $task
     * @param  DateTime $day
     * @param  bool     $save
     * @return Entry
     */
    protected function createDailyTask(Entry $task, DateTime $day, bool $save = true): Entry
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
            'startDate' => $day
        ]);
        $this->populateDailyTask($daily, $task, $day);
        if (!$task->timeBased and $task->taskType->value == 'less') {
            $daily->setFieldValue('done', true);
        }
        $daily->scenario = Element::SCENARIO_LIVE;
        if ($save and !\Craft::$app->elements->saveElement($daily)) {
            throw new Exception("Couldn't save daily task : " . print_r($daily->errors, true));
        }
        return $daily;
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
        $date = $dailyTask->startDate;
        if ($now->format('Y-m-d') == $date->format('Y-m-d')) {
            return false;
        }
        if (!$dailyTask->getTask()->archive and
            !$dailyTask->isPaused() and
            $dailyTask->hasDerailed() and
            $dailyTask->author->status == User::STATUS_ACTIVE
        ) {
            $chargeSucceeded = false;
            $intent = null;
            $amount = MoneyHelper::toNumber($dailyTask->committed);
            if ($amount > 0 && !$dailyTask->chargeId) {
                // Old model: charge on derail (no pre-existing charge)
                list($chargeSucceeded, $intent) = Stripe::$plugin->stripe->chargeForDerail($dailyTask);
            } elseif ($dailyTask->chargeId) {
                // New model: already charged on commit, charge stands as forfeiture
                $chargeSucceeded = true;
                $intent = null;
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
                'hasDerailed' => true,
                'chargeId' => $intent ? $intent->latest_charge : ($dailyTask->chargeId ?: ''),
            ]);
        }
        $dailyTask->setFieldValues([
            'processed' => true
        ]);
        \Craft::$app->elements->saveElement($dailyTask, false);
        return $dailyTask->hasDerailed;
    }

    /**
     * Populate a daily task from a task
     *
     * @param  Entry         $daily
     * @param  Entry         $task
     * @param  DateTime|null $day
     */
    protected function populateDailyTask(Entry $daily, Entry $task, ?DateTime $day = null)
    {
        $daily->setFieldValues([
            'taskType' => $task->taskType,
            'deadline' => $task->deadline,
            'length' => $task->getDuration($day),
            'committed' => $task->committed,
            'paused' => $task->paused,
            'timeBased' => $task->timeBased
        ]);
    }
}
