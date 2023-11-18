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
        $type = $this->request->getRequiredParam('chartType');
        $dataTracked = $this->request->getRequiredParam('dataTracked');
        $blocks = \Craft::$app->fields->createField(['type' => Matrix::class])->serializeValue($user->charts);
        $blocks['new:1'] = [
            'type' => 'chart',
            'fields' => $this->getChartFieldValues($type, $dataTracked)
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

    protected function getChartFieldValues(string $type, string $dataTracked): array
    {
        $data = [
            'chartType' => $type,
            'dataTracked' => $dataTracked,
        ];
        if ($dataTracked == 'derails') {
            $data['chartTitle'] = 'Derails this year';
            $data['dateRange'] = 'thisYear';
            if ($type == 'line') {
                $data['groupBy'] = 'months';
            }
        } elseif ($dataTracked == 'moneySpent') {
            $data['dateRange'] = 'thisMonth';
            $data['chartTitle'] = 'Money spent this month';
        } elseif ($dataTracked == 'timeSpent') {
            $data['dateRange'] = 'thisMonth';
            $data['chartTitle'] = 'Time spent this month';
        }
        return $data;
    }
}
