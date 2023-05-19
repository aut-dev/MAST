<?php

namespace Plugins\Tasks\behaviors;

use Plugins\Tasks\Tasks;
use yii\base\Behavior;
use DateTime;

class BlockBehavior extends Behavior
{
    public $owner;

    public function getIsExpired(): bool
    {
        return $this->owner->deadline < (new DateTime());
    }
}
