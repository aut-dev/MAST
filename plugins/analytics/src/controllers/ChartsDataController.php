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
        $dataTracked = $this->request->getRequiredParam('dataTracked');
        $chartType = $this->request->getRequiredParam('chartType');
        $filters = [];
        foreach (['allTasks', 'cumulative', 'dateFrom', 'dateTo', 'dateRange', 'groupBy', 'tasks'] as $field) {
            $filters[$field] = $this->request->getRequiredParam($field);
        }
        $service = $dataTracked . 'Data';
        $method = 'for' . ucfirst($chartType);
        $user = \Craft::$app->user->identity;
        return $this->asJson(Analytics::$plugin->$service->$method($user, $filters));
    }
}
