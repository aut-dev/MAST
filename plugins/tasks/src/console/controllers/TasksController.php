<?php

namespace Plugins\Tasks\console\controllers;

use Plugins\Tasks\Tasks;
use craft\console\Controller;
use yii\console\ExitCode;

class TasksController extends Controller
{
    public function actionCheckDerails()
    {
        $total = Tasks::$plugin->tasks->checkDerails();
        $this->stdout("Found $total derailed tasks and charged users\n");
        return ExitCode::OK;
    }
}
