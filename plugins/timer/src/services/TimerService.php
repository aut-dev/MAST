<?php

namespace Plugins\Timer\services;

use DateTime;
use Exception;
use Plugins\Timesheets\Timesheets;
use craft\base\Component;
use craft\elements\Entry;

class TimerService extends Component
{
    public function start(int $blockId)
    {
        $user = \Craft::$app->user->identity;
        if ($user->timerStarted) {
            throw new Exception("Timer is already started");
        }
        $block = Entry::find()->id($blockId)->one();
        if ($block->isExpired) {
            throw new Exception("This task has expired");
        }
        $user->setFieldValues([
            'timerStarted' => new DateTime(),
            'taskBlock' => [$blockId]
        ]);
        \Craft::$app->elements->saveElement($user, false);
    }

    public function stop()
    {
        $user = \Craft::$app->user->identity;
        if (!$user->timerStarted) {
            throw new Exception("Timer is not started");
        }
        Timesheets::$plugin->timesheets->addTimesheet($user->taskBlock->one(), $user->timerStarted, new DateTime());
        $user->setFieldValues([
            'taskBlock' => [],
            'timerStarted' => null
        ]);
        \Craft::$app->elements->saveElement($user, false);
    }

    public function reset()
    {
        $user = \Craft::$app->user->identity;
        $user->setFieldValues([
            'timerStartedUnsaved' => null,
            'timerStoppedUnsaved' => null
        ]);
        if (!$user->timerStarted) {
            $user->setFieldValue('timerTask', []);
        }
        \Craft::$app->elements->saveElement($user, false);
    }
}
