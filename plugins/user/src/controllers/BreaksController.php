<?php

namespace Plugins\Users\controllers;

use craft\db\Paginator;
use craft\elements\Entry;
use craft\helpers\DateTimeHelper;
use craft\web\Controller;
use yii\web\ForbiddenHttpException;

class BreaksController extends Controller
{
    public function actionGet()
    {
        $user = \Craft::$app->user->identity;
        $query = Entry::find()->section('break')->authorId($user->id);
        if (!$this->request->getParam('showPast', false)) {
            $now = DateTimeHelper::toDateTime('now');
            $query->endDate('>=' . $now->format('Y-m-d'));
        }
        $paginator = new Paginator($query, [
            'pageSize' => 10,
            'currentPage' => $this->request->getBodyParam('page', 1)
        ]);
        $breaks = array_map(function ($break) use ($user) {
            return [
                'id' => $break->id,
                'title' => $break->title,
                'startDate' => $break->startDate->format('Y-m-d'),
                'endDate' => $break->endDate->format('Y-m-d'),
                'startDateAlt' => $break->startDate->format('d/m/Y'),
                'endDateAlt' => $break->endDate->format('d/m/Y'),
                'past' => $break->endDate < $user->today
            ];
        }, $paginator->getPageResults());
        return $this->asJson([
            'breaks' => $breaks,
            'totalPages' => $paginator->getTotalPages()
        ]);
    }

    public function actionSetUnlimitedBreak()
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
