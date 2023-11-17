<?php

namespace Plugins\Analytics\controllers;

use DateInterval;
use Plugins\Analytics\Analytics;
use craft\elements\Entry;
use craft\fields\Matrix;
use craft\helpers\Json;
use craft\web\Controller;

class ChartsController extends Controller
{
    public function actionSaveChart()
    {
        $this->requireLogin();
        $this->requirePostRequest();
        $user = \Craft::$app->user->identity;
        $id = $this->request->getRequiredParam('id');
        $fields = $this->request->getRequiredParam('fields');
        $chart = $user->charts->id($id)->one();
        $chart->setFieldValues($fields);
        \Craft::$app->elements->saveElement($chart);
        return $this->asJson([]);
    }

    public function actionCreateChart()
    {
        $this->requireLogin();
        $this->requirePostRequest();
        $user = \Craft::$app->user->identity;
        $type = $this->request->getRequiredParam('type');
        $blocks = \Craft::$app->fields->createField(['type' => Matrix::class])->serializeValue($user->charts);
        $blocks['new:1'] = [
            'type' => 'chart',
            'fields' => $this->getChartFieldValues($type)
        ];
        $user->setFieldValue('charts', [
            'sortOrder' => array_keys($blocks),
            'blocks' => $blocks
        ]);
        \Craft::$app->elements->saveElement($user, false);
        $charts = $user->charts->all();
        return $this->asJson(Analytics::$plugin->analytics->getJsonChart(end($charts)));
    }

    public function actionDeleteChart()
    {
        $this->requireLogin();
        $this->requirePostRequest();
        $user = \Craft::$app->user->identity;
        $id = $this->request->getRequiredParam('id');
        $blocks = \Craft::$app->fields->createField(['type' => Matrix::class])->serializeValue($user->charts);
        unset($blocks[$id]);
        $user->setFieldValue('charts', [
            'sortOrder' => array_keys($blocks),
            'blocks' => $blocks
        ]);
        \Craft::$app->elements->saveElement($user, false);
        return $this->asJson([]);
    }

    public function getChartFieldValues(string $type)
    {
        $data = [
            'size' => 12,
            'chartType' => $type,
            'filters' => [
                'dateRange' => 'thisYear',
                'groupBy' => 'months',
                'allTasks' => true,
                'tasks' => []
            ]
        ];
        if ($type == 'derails') {
            $data['chartTitle'] = 'Derails per task';
        } elseif ($type == 'moneySpent') {
            $data['filters']['dateRange'] = 'thisMonth';
            $data['filters']['groupBy'] = 'days';
            $data['chartTitle'] = 'Money spent per task';
        } elseif ($type == 'timeSpent') {
            $data['filters']['dateRange'] = 'thisMonth';
            $data['filters']['groupBy'] = 'days';
            $data['chartTitle'] = 'Time spent per task';
        }
        $data['filters'] = Json::encode($data['filters']);
        return $data;
    }
}
