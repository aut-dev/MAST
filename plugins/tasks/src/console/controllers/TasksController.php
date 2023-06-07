<?php

namespace Plugins\Tasks\console\controllers;

use Plugins\Tasks\Tasks;
use craft\console\Controller;
use craft\helpers\DateTimeHelper;
use yii\console\ExitCode;

class TasksController extends Controller
{
    /**
     * Schedule tasks between 2 dates
     *
     * @return int
     */
    public function actionScheduleTasks()
    {
        $total = Tasks::$plugin->tasks->scheduleTasks();
        $this->stdout("Scheduled $total tasks\n");
        return ExitCode::OK;
    }
}
