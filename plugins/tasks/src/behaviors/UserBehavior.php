<?php

namespace Plugins\Tasks\behaviors;

use Plugins\Tasks\Tasks;
use yii\base\Behavior;

class UserBehavior extends Behavior
{
    public $owner;
    protected $_todayBlocks;

    public function getTodaysBlocks(): array
    {
        if ($this->_todayBlocks === null) {
            $this->_todayBlocks = Tasks::$plugin->tasks->getTodaysBlocks($this->owner);
        }
        return $this->_todayBlocks;
    }
}
