<?php

namespace Plugins\Tasks\controllers;

use DateTime;
use Plugins\Tasks\Tasks;
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
            $startDate = DateTime::createFromFormat('Y-m-d', $startDate);
            $now = (new DateTime())->setTime(0, 0, 0);
            if (!$startDate) {
                $errors['startDate'] = ['Start date is not valid'];
            } elseif ($startDate < $now) {
                $errors['startDate'] = ['Start date must be at minimum today'];
            }
        }
        if (!$deadline) {
            $errors['deadline'] = ['Deadline is required'];
        } else {
            $deadline = DateTime::createFromFormat('H:i', $deadline);
            if (!$deadline) {
                $errors['deadline'] = ['Deadline is not valid'];
            }
        }
        if (!$committed) {
            $errors['committed'] = ['Committed is required'];
        } elseif ($length < 1) {
            $errors['committed'] = ['Committed must be at minimum 1'];
        }
        if ($errors) {
            $this->response->setStatusCode(400);
            return $this->asJson([
                'errors' => $errors
            ]);
        }
        $task = Tasks::$plugin->tasks->createTask($name);
        Tasks::$plugin->tasks->createBlocks($task, $startDate, $length, $deadline, $committed);
        return $this->asJson([
            'redirect' => '/tasks'
        ]);
    }
}
