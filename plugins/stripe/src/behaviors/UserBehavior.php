<?php

namespace Plugins\Stripe\behaviors;

use Plugins\Stripe\Stripe;
use yii\base\Behavior;

class UserBehavior extends Behavior
{
    public $owner;

    public function getHasValidMembership()
    {
        if (!$this->owner->membershipExpires) {
            return false;
        }
        return $this->owner->now < $this->owner->membershipExpires;
    }

    public function getHasValidPaymentMethod()
    {
        $method = Stripe::$plugin->stripe->getPaymentMethod($this->owner);
        if (!$method) {
            return false;
        }
        $card = $method->card;
        $now = $this->owner->now;
        if ($card->exp_year < $now->format('Y')) {
            return false;
        }
        if ($card->exp_year == $now->format('Y')) {
            return ($card->exp_month > $now->format('n'));
        }
        return true;
    }

    public function getPaymentMethodExpiresSoon()
    {
        $method = Stripe::$plugin->stripe->getPaymentMethod($this->owner);
        if (!$method) {
            return false;
        }
        $card = $method->card;
        $now = $this->owner->now;
        return ($card->exp_year == $now->format('Y') and $card->exp_month == ($now->format('n') - 1));
    }
}
