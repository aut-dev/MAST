<?php

namespace Plugins\Timesheets\controllers;

use craft\db\Paginator;
use craft\elements\Entry;
use craft\web\Controller;
use yii\web\ForbiddenHttpException;

class TimesheetsController extends Controller
{
    public function actionGet()
    {
        $this->requireLogin();
        $user = \Craft::$app->user->identity;
        $paginator = new Paginator(Entry::find()->section('timesheet')->authorId($user->id)->relatedTo($this->request->getRequiredParam('id')), [
            'pageSize' => 10,
            'currentPage' => $this->request->getBodyParam('page', 1)
        ]);
        $sheets = array_map(function ($sheet) use ($user) {
            return [
                'id' => $sheet->id,
                'startDate' => $sheet->startDate->format('Y-m-d H:i:s'),
                'endDate' => $sheet->endDate->format('Y-m-d H:i:s'),
                'startDateAlt' => $sheet->startDate->format('d/m/Y H:i:s'),
                'endDateAlt' => $sheet->endDate->format('d/m/Y H:i:s'),
                'friendlySpentTime' => $sheet->friendlySpentTime()
            ];
        }, $paginator->getPageResults());
        return $this->asJson([
            'sheets' => $sheets,
            'totalPages' => $paginator->getTotalPages()
        ]);
    }
}
