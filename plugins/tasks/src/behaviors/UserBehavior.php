<?php

namespace Plugins\Tasks\behaviors;

use Plugins\Tasks\Tasks;
use yii\base\Behavior;

class UserBehavior extends Behavior
{
    public $owner;
    protected $_todayBlocks;
    protected $_futureBlocks;

    public function getTodaysBlocks(): array
    {
        if ($this->_todayBlocks === null) {
            $this->_todayBlocks = Tasks::$plugin->tasks->getTodaysBlocks($this->owner);
        }
        return $this->_todayBlocks;
    }

    public function getFutureBlocks(): array
    {
        if ($this->_futureBlocks === null) {
            $this->_futureBlocks = Tasks::$plugin->tasks->getFutureBlocks($this->owner);
        }
        return $this->_futureBlocks;
    }
}
