<?php

namespace Plugins\Timer\services;

use DateTime;
use Exception;
use Illuminate\Support\Collection;
use Plugins\Timesheets\Timesheets;
use craft\base\Component;
use craft\elements\Entry;
use craft\elements\MatrixBlock;
use craft\elements\User;

class TimerService extends Component
{
    /**
     * Start the time for a task
     *
     * @param  int    $taskId
     * @param  User   $user
     */
    public function start(int $taskId, User $user)
    {
        if ($this->timerStarted($taskId, $user)) {
            throw new Exception("Timer is already started");
        }
        $timer = $user->timer instanceof Collection ? $user->timer : $user->timer->with('timer:task')->all();
        $blocks = [];
        $order = [];
        foreach ($timer as $timer) {
            $blocks[$timer->id] = [
                'type' => 'timer',
                'fields' => [
                    'task' => $timer->task[0]->id,
                    'started' => $timer->started
                ]
            ];
            $order[] = $timer->id;
        }
        $blocks['new1'] = [
            'type' => 'timer',
            'fields' => [
                'task' => [$taskId],
                'started' => $user->now
            ]
        ];
        $order[] = 'new1';
        $user->setFieldValue('timer', [
            'sortOrder' => $order,
            'blocks' => $blocks
        ]);
        \Craft::$app->elements->saveElement($user, false);
    }

    /**
     * Stop the timer for a task
     *
     * @param  int    $taskId
     * @param  User   $user
     */
    public function stop(int $taskId, User $user)
    {
        $user = \Craft::$app->user->identity;
        $block = $this->timerBlock($taskId, $user);
        if (!$block) {
            throw new Exception("Timer is not started");
        }
        $task = $block->task[0];
        Timesheets::$plugin->timesheets->addTimesheet($task, $block->started, $user->now);
        $timer = $user->timer instanceof Collection ? $user->timer : $user->timer->with('timer:task')->all();
        $blocks = [];
        $order = [];
        foreach ($timer as $timer) {
            if ($timer->id == $block->id) {
                continue;
            }
            $blocks[$timer->id] = [
                'type' => 'timer',
                'fields' => [
                    'task' => $timer->task[0]->id,
                    'started' => $timer->started
                ]
            ];
            $order[] = $timer->id;
        }
        $user->setFieldValue('timer', [
            'sortOrder' => $order,
            'blocks' => $blocks
        ]);
        \Craft::$app->elements->saveElement($user, false);
        return Entry::find()->id($task->id)->one();
    }

    /**
     * Get the date the timer was started for a task
     *
     * @param  int    $taskId
     * @param  User   $user
     * @return ?DateTime
     */
    public function timerStarted(int $taskId, User $user): ?DateTime
    {
        $block = $this->timerBlock($taskId, $user);
        if ($block) {
            return $block->started;
        }
        return null;
    }

    /**
     * Get the timer block related to a task
     *
     * @param  int    $taskId
     * @param  User   $user
     * @return ?MatrixBlock
     */
    public function timerBlock(int $taskId, User $user): ?MatrixBlock
    {
        $timer = $user->timer instanceof Collection ? $user->timer : $user->timer->with('timer:task')->all();
        foreach ($timer as $block) {
            if (sizeof($block->task) and $block->task[0]->id == $taskId) {
                return $block;
            }
        }
        return null;
    }
}
