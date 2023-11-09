<?php

namespace Plugins\Analytics\controllers;

use Plugins\Analytics\Analytics;
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
        return $this->asJson(Analytics::$plugin->analytics->timePerTaskData($user, $groupBy, $dateFrom, $dateTo));
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
        return $this->asJson(Analytics::$plugin->analytics->derailsPerTaskData($user, $groupBy, $dateFrom, $dateTo));
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
        return $this->asJson(Analytics::$plugin->analytics->moneyPerTaskData($user, $groupBy, $dateFrom, $dateTo));
    }
}
