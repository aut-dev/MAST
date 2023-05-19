<?php

namespace Plugins\Tasks\controllers;

use DateTime;
use Plugins\Tasks\Tasks;
use craft\helpers\DateTimeHelper;
use craft\web\Controller;

class TasksController extends Controller
{
    public function actionSaveBlocks()
    {
        $name = $this->request->getBodyParam('name');
        $startDate = $this->request->getBodyParam('startDate');
        $length = $this->request->getBodyParam('length');
        $deadline = $this->request->getBodyParam('deadline');
        $committed = $this->request->getBodyParam('committed');
        $until = $this->request->getBodyParam('until');
        $repeat = $this->request->getBodyParam('repeat');
        $days = $this->request->getBodyParam('days');
        $errors = [];
        if (!$name) {
            $errors['name'] = ['Name is required'];
        }
        if (!$length) {
            $errors['length'] = ['Length is required'];
        } elseif ($length < 1) {
            $errors['length'] = ['Length must be at minimum 1'];
        }
        if (!$startDate) {
            $errors['startDate'] = ['Start date is required'];
        } else {
            $startDate = DateTimeHelper::toDateTime($startDate);
            $now = (new DateTime())->setTime(0, 0, 0);
            if (!$startDate) {
                $errors['startDate'] = ['Start date is not valid'];
            } elseif ($startDate < $now) {
                $errors['startDate'] = ['Start date must be at minimum today'];
            }
            if (!$days[$startDate->format('D')]) {
                $errors['days'] = ['You must have a work block for your starting day ' . $startDate->format('D')];
            }
        }
        if (!$deadline) {
            $errors['deadline'] = ['Deadline is required'];
        } else {
            $startDate->setTime(...explode(':', $deadline));
        }
        if (!$committed) {
            $errors['committed'] = ['Committed is required'];
        } elseif ($length < 1) {
            $errors['committed'] = ['Committed must be at minimum 1'];
        }
        if ($repeat and !$until) {
            $errors['until'] = ['Until is required'];
        }
        $until = $until['date'] ? DateTimeHelper::toDateTime($until) : null;
        $total = 0;
        foreach ($days as $amount) {
            $total += $amount;
        }
        if ($repeat and !$total) {
            $errors['days'] = ['You must have at least one block for a day'];
        }
        if ($errors) {
            $this->response->setStatusCode(400);
            return $this->asJson([
                'errors' => $errors
            ]);
        }
        $task = Tasks::$plugin->tasks->createTask($name);
        Tasks::$plugin->tasks->createBlocks($task, $startDate, $length, $committed, $repeat, $until, $days);
        \Craft::$app->session->setNotice(\Craft::t('site', 'Tasks have been created'));
        return $this->asJson([
            'redirect' => '/tasks'
        ]);
    }
}
