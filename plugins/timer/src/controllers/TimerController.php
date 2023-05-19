<?php

namespace Plugins\Timer\controllers;

use DateTime;
use Exception;
use Plugins\Timer\Timer;
use craft\web\Controller;

class TimerController extends Controller
{
    public function actionStart()
    {
        $blockId = $this->request->getRequiredParam('blockId');
        try {
            Timer::$plugin->timer->start($blockId);
        } catch (\Exception $e) {
            $this->response->setStatusCode(400);
            return $this->asJson(['error' => $e->getMessage()]);
        }
        return $this->asJson([
            'current' => \Craft::$app->view->renderTemplate('_includes/current-timer')
        ]);
    }

    public function actionStop()
    {
        try {
            $block = Timer::$plugin->timer->stop();
        } catch (\Exception $e) {
            $this->response->setStatusCode(400);
            return $this->asJson(['error' => $e->getMessage()]);
        }
        return $this->asJson([
            'complete' => $block->isComplete,
            'blockId' => $block->id
        ]);
    }

    public function actionPollProgress()
    {
        $user = \Craft::$app->user->identity;
        $block = $user->taskBlock->one();
        if (!$block) {
            return $this->asJson([
                'running' => false
            ]);
        }
        $time = $block->timeSpent + $user->getTimerSpent($block);
        return $this->asJson([
            'running' => true,
            'blockId' => $block->id,
            'time' => $time,
            'percent' => $time / $block->length * 100
        ]);
    }
}
