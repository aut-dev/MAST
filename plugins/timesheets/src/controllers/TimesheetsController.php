<?php

namespace Plugins\Timesheets\controllers;

use craft\elements\Entry;
use craft\web\Controller;
use yii\web\ForbiddenHttpException;

class TimesheetsController extends Controller
{
    public function actionGet()
    {
        $this->requireLogin();
        $user = \Craft::$app->user->identity;
        $id = $this->request->getRequiredParam('id');
        $sheet = Entry::find()->section('timesheet')->id($id)->authorId($user->id)->one();
        if (!$sheet) {
            throw new ForbiddenHttpException('Timesheet not found');
        }
        return $this->asJson([
            'start' => $sheet->startDate->format('Y-m-d H:i:s'),
            'end' => $sheet->endDate->format('Y-m-d H:i:s')
        ]);
    }
}
