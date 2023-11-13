<?php

namespace Plugins\Analytics\controllers;

use Plugins\Analytics\Analytics;
use craft\elements\Entry;
use craft\web\Controller;

class AnalyticsController extends Controller
{
    public function actionTimePerTask()
    {
        $this->requirePostRequest();
        $groupBy = $this->request->getRequiredParam('groupBy');
        $user = \Craft::$app->user->identity;
        $elems = explode('-', $this->request->getRequiredParam('dateFrom'));
        $dateFrom = $user->getNow()->setDate($elems[0], $elems[1], $elems[2])->setTime(0, 0, 0);
        $elems = explode('-', $this->request->getRequiredParam('dateTo'));
        $dateTo = $user->getNow()->setDate($elems[0], $elems[1], $elems[2])->setTime(23, 59, 59);
        $ids = $this->request->getRequiredParam('tasks');
        $tasks = Entry::find()->section('task')->authorId($user->id)->id($ids)->all();
        return $this->asJson(Analytics::$plugin->analytics->timePerTaskData($tasks, $user, $groupBy, $dateFrom, $dateTo));
    }

    public function actionDerailsPerTask()
    {
        $this->requirePostRequest();
        $groupBy = $this->request->getRequiredParam('groupBy');
        $user = \Craft::$app->user->identity;
        $elems = explode('-', $this->request->getRequiredParam('dateFrom'));
        $dateFrom = $user->getNow()->setDate($elems[0], $elems[1], $elems[2])->setTime(0, 0, 0);
        $elems = explode('-', $this->request->getRequiredParam('dateTo'));
        $dateTo = $user->getNow()->setDate($elems[0], $elems[1], $elems[2])->setTime(23, 59, 59);
        $tasks = null;
        if ($ids = $this->request->getRequiredParam('tasks')) {
            $tasks = Entry::find()->section('task')->authorId($user->id)->id($ids)->all();
        }
        return $this->asJson(Analytics::$plugin->analytics->derailsPerTaskData($tasks, $user, $groupBy, $dateFrom, $dateTo));
    }

    public function actionMoneyPerTask()
    {
        $this->requirePostRequest();
        $groupBy = $this->request->getRequiredParam('groupBy');
        $user = \Craft::$app->user->identity;
        $elems = explode('-', $this->request->getRequiredParam('dateFrom'));
        $dateFrom = $user->getNow()->setDate($elems[0], $elems[1], $elems[2])->setTime(0, 0, 0);
        $elems = explode('-', $this->request->getRequiredParam('dateTo'));
        $dateTo = $user->getNow()->setDate($elems[0], $elems[1], $elems[2])->setTime(23, 59, 59);
        $tasks = null;
        if ($ids = $this->request->getRequiredParam('tasks')) {
            $tasks = Entry::find()->section('task')->authorId($user->id)->id($ids)->all();
        }
        return $this->asJson(Analytics::$plugin->analytics->moneyPerTaskData($tasks, $user, $groupBy, $dateFrom, $dateTo));
    }
}
