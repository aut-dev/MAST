<?php

namespace Plugins\Tasks\behaviors;

use craft\elements\Entry;
use yii\base\Behavior;

class UserBehavior extends Behavior
{
    public $owner;

    /**
     * Get the total amount this user has paid, including archived tasks
     *
     * @return float
     */
    public function getTotalPaid(): float
    {
        $daily = Entry::find()->section('dailyTask')->chargeSucceeded(true)->authorId($this->owner->id)->all();
        $total = 0;
        foreach ($daily as $daily) {
            $total += $daily->committed->getAmount() / 100;
        }
        return $total;
    }
}
