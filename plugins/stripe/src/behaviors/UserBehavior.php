<?php

namespace Plugins\Stripe\behaviors;

use Plugins\Stripe\Stripe;
use Stripe\PaymentMethod;
use yii\base\Behavior;

class UserBehavior extends Behavior
{
    public $owner;

    /**
     * Does the user have a valid payment method (which hasn't expired)
     *
     * @return bool
     */
    public function getHasValidPaymentMethod(): bool
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

    /**
     * Does the saved payment method expire soon (in less than a month)
     *
     * @return bool
     */
    public function getPaymentMethodExpiresSoon(): bool
    {
        $method = Stripe::$plugin->stripe->getPaymentMethod($this->owner);
        if (!$method) {
            return false;
        }
        $card = $method->card;
        $now = $this->owner->now;
        return ($card->exp_year == $now->format('Y') and $card->exp_month == ($now->format('n') - 1));
    }

    /**
     * Get the stripe payment method saved for the user
     *
     * @return ?PaymentMethod
     */
    public function getPaymentMethod(): ?PaymentMethod
    {
        return Stripe::$plugin->stripe->getPaymentMethod($this->owner);
    }
}
