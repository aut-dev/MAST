<?php

namespace Plugins\Analytics\controllers;

use DateInterval;
use Plugins\Analytics\Analytics;
use craft\elements\Entry;
use craft\web\Controller;

class ChartsDataController extends Controller
{
    public function actionIndex()
    {
        $this->requirePostRequest();
        $this->requireLogin();
        $dataTracked = $this->request->getRequiredParam('dataTracked');
        $chartType = $this->request->getRequiredParam('chartType');
        $filters = $this->request->getRequiredParam('filters');
        $service = $dataTracked . 'Data';
        $method = 'for' . ucfirst($chartType);
        $user = \Craft::$app->user->identity;
        return $this->asJson(Analytics::$plugin->$service->$method($user, $filters));
    }
    public function actionTimeSpent()
    {
        $this->requirePostRequest();
        $this->requireLogin();
        $groupBy = $this->request->getRequiredParam('groupBy');
        $range = $this->request->getRequiredParam('dateRange');
        $allTasks = $this->request->getRequiredParam('allTasks');
        $taskIds = $this->request->getRequiredParam('tasks');
        $cumulative = $this->request->getBodyParam('cumulative', false);
        $user = \Craft::$app->user->identity;
        list($dateFrom, $dateTo) = $this->getDates($range);
        $tasks = $allTasks ? null : Entry::find()->section('task')->authorId($user->id)->id($taskIds)->all();
        return $this->asJson(Analytics::$plugin->analytics->timeSpentData($tasks, $user, $groupBy, $dateFrom, $dateTo, $cumulative));
    }

    public function actionDerails()
    {
        $this->requirePostRequest();
        $this->requireLogin();
        $groupBy = $this->request->getRequiredParam('groupBy');
        $range = $this->request->getRequiredParam('dateRange');
        $allTasks = $this->request->getRequiredParam('allTasks');
        $taskIds = $this->request->getRequiredParam('tasks');
        $cumulative = $this->request->getBodyParam('cumulative', false);
        $user = \Craft::$app->user->identity;
        list($dateFrom, $dateTo) = $this->getDates($range);
        $tasks = $allTasks ? null : Entry::find()->section('task')->authorId($user->id)->id($taskIds)->all();
        return $this->asJson(Analytics::$plugin->analytics->derailsData($tasks, $user, $groupBy, $dateFrom, $dateTo, $cumulative));
    }

    public function actionMoneySpent()
    {
        $this->requirePostRequest();
        $this->requireLogin();
        $groupBy = $this->request->getRequiredParam('groupBy');
        $range = $this->request->getRequiredParam('dateRange');
        $allTasks = $this->request->getRequiredParam('allTasks');
        $taskIds = $this->request->getRequiredParam('tasks');
        $cumulative = $this->request->getBodyParam('cumulative', false);
        $user = \Craft::$app->user->identity;
        list($dateFrom, $dateTo) = $this->getDates($range);
        $tasks = $allTasks ? null : Entry::find()->section('task')->authorId($user->id)->id($taskIds)->all();
        return $this->asJson(Analytics::$plugin->analytics->moneySpentData($tasks, $user, $groupBy, $dateFrom, $dateTo, $cumulative));
    }
}
