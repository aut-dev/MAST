<?php

namespace Plugins\Users\controllers;

use craft\elements\Entry;
use craft\web\Controller;
use yii\web\ForbiddenHttpException;

class BreaksController extends Controller
{
    public function actionGet()
    {
        $this->requireLogin();
        $user = \Craft::$app->user->identity;
        $id = $this->request->getRequiredParam('id');
        $break = Entry::find()->section('break')->id($id)->authorId($user->id)->one();
        if (!$break) {
            throw new ForbiddenHttpException('Break not found');
        }
        return $this->asJson([
            'title' => $break->title,
            'start' => $break->startDate->format('Y-m-d'),
            'end' => $break->endDate->format('Y-m-d')
        ]);
    }

    public function actionUnlimitedBreak()
    {
        $user = \Craft::$app->user->identity;
        $date = null;
        if ($this->request->getBodyParam('unlimitedBreak', false)) {
            $date = $user->today;
        }
        $user->setFieldValue('unlimitedBreakStart', $date);
        \Craft::$app->elements->saveElement($user, false);
        return $this->asJson([]);
    }
}
