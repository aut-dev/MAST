<?php

namespace Plugins\Analytics\controllers;

use DateInterval;
use Plugins\Analytics\Analytics;
use craft\elements\Entry;
use craft\web\Controller;

class ChartsDataController extends Controller
{
    public function actionTimeSpent()
    {
        $this->requirePostRequest();
        $this->requireLogin();
        $groupBy = $this->request->getRequiredParam('groupBy');
        $range = $this->request->getRequiredParam('dateRange');
        $allTasks = $this->request->getRequiredParam('allTasks');
        $taskIds = $this->request->getRequiredParam('tasks');
        $user = \Craft::$app->user->identity;
        list($dateFrom, $dateTo) = $this->getDates($range);
        $tasks = $allTasks ? null : Entry::find()->section('task')->authorId($user->id)->id($taskIds)->all();
        return $this->asJson(Analytics::$plugin->analytics->timeSpentData($tasks, $user, $groupBy, $dateFrom, $dateTo));
    }

    public function actionDerails()
    {
        $this->requirePostRequest();
        $this->requireLogin();
        $groupBy = $this->request->getRequiredParam('groupBy');
        $range = $this->request->getRequiredParam('dateRange');
        $allTasks = $this->request->getRequiredParam('allTasks');
        $taskIds = $this->request->getRequiredParam('tasks');
        $user = \Craft::$app->user->identity;
        list($dateFrom, $dateTo) = $this->getDates($range);
        $tasks = $allTasks ? null : Entry::find()->section('task')->authorId($user->id)->id($taskIds)->all();
        return $this->asJson(Analytics::$plugin->analytics->derailsData($tasks, $user, $groupBy, $dateFrom, $dateTo));
    }

    public function actionMoneySpent()
    {
        $this->requirePostRequest();
        $this->requireLogin();
        $groupBy = $this->request->getRequiredParam('groupBy');
        $range = $this->request->getRequiredParam('dateRange');
        $allTasks = $this->request->getRequiredParam('allTasks');
        $taskIds = $this->request->getRequiredParam('tasks');
        $user = \Craft::$app->user->identity;
        list($dateFrom, $dateTo) = $this->getDates($range);
        $tasks = $allTasks ? null : Entry::find()->section('task')->authorId($user->id)->id($taskIds)->all();
        return $this->asJson(Analytics::$plugin->analytics->moneySpentData($tasks, $user, $groupBy, $dateFrom, $dateTo));
    }

    protected function getDates(string $range): array
    {
        $user = \Craft::$app->user->identity;
        if ($range == 'custom') {
            $elems = explode('-', $this->request->getRequiredParam('dateFrom'));
            $dateFrom = $user->getNow()->setDate($elems[0], $elems[1], $elems[2])->setTime(0, 0, 0);
            $elems = explode('-', $this->request->getRequiredParam('dateTo'));
            $dateTo = $user->getNow()->setDate($elems[0], $elems[1], $elems[2])->setTime(23, 59, 59);
        } elseif ($range == 'thisWeek') {
            $dateTo = $user->getNow();
            $dateFrom = clone $dateTo;
            while ($dateFrom->format('N') != 1) {
                $dateFrom->sub(new DateInterval('P1D'));
            }
            $dateFrom->setTime(0, 0, 0);
        } elseif ($range == 'lastWeek') {
            $dateTo = $user->getNow()->sub(new DateInterval('P1D'));
            while ($dateTo->format('N') != 7) {
                $dateTo->sub(new DateInterval('P1D'));
            }
            $dateFrom = clone $dateTo;
            while ($dateFrom->format('N') != 1) {
                $dateFrom->sub(new DateInterval('P1D'));
            }
            $dateFrom->setTime(0, 0, 0);
            $dateTo->setTime(23, 59, 59);
        } elseif ($range == 'thisMonth') {
            $dateTo = $user->getNow();
            $dateFrom = clone $dateTo;
            while ($dateFrom->format('j') != 1) {
                $dateFrom->sub(new DateInterval('P1D'));
            }
            $dateFrom->setTime(0, 0, 0);
        } elseif ($range == 'lastMonth') {
            $dateTo = $user->getNow();
            $thisMonth = $dateTo->format('n');
            while ($dateTo->format('n') == $thisMonth) {
                $dateTo->sub(new DateInterval('P1D'));
            }
            $dateFrom = clone $dateTo;
            while ($dateFrom->format('j') != 1) {
                $dateFrom->sub(new DateInterval('P1D'));
            }
            $dateFrom->setTime(0, 0, 0);
            $dateTo->setTime(23, 59, 59);
        } elseif ($range == 'thisYear') {
            $dateTo = $user->getNow();
            $dateFrom = clone $dateTo;
            while ($dateFrom->format('d/m') != '01/01') {
                $dateFrom->sub(new DateInterval('P1D'));
            }
            $dateFrom->setTime(0, 0, 0);
        } elseif ($range == 'lastYear') {
            $dateTo = $user->getNow();
            $thisYear = $dateTo->format('Y');
            while ($dateTo->format('Y') == $thisYear) {
                $dateTo->sub(new DateInterval('P1D'));
            }
            $dateFrom = clone $dateTo;
            while ($dateFrom->format('d/m') != '01/01') {
                $dateFrom->sub(new DateInterval('P1D'));
            }
            $dateFrom->setTime(0, 0, 0);
            $dateTo->setTime(23, 59, 59);
        }
        return [$dateFrom, $dateTo];
    }
}
