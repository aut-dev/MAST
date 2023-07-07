<?php

namespace Plugins\Timesheets\behaviors;

use Plugins\Timesheets\Timesheets;
use yii\base\Behavior;
use DateInterval;
use DateTime;

class TaskBehavior extends Behavior
{
    public $owner;
}
