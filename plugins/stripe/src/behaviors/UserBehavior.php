<?php

namespace Plugins\Stripe\behaviors;

use Plugins\Stripe\Stripe;
use yii\base\Behavior;

class UserBehavior extends Behavior
{
    public $owner;

    public function getPaymentMethods(): array
    {
        return Stripe::$plugin->stripe->getPaymentMethods($this->owner);
    }
}
