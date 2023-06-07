<?php

namespace Plugins\Tasks\behaviors;

use Plugins\Tasks\Tasks;
use yii\base\Behavior;

class UserBehavior extends Behavior
{
    public $owner;
    protected $_todayTasks;

    public function getTodaysTasks(): array
    {
        if ($this->_todayTasks === null) {
            $this->_todayTasks = Tasks::$plugin->tasks->getTodaysTasks($this->owner);
        }
        return $this->_todayTasks;
    }
}
