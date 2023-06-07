<?php

namespace Plugins\Stripe\services;

use Stripe\Customer;
use Stripe\PaymentMethod;
use Stripe\SetupIntent;
use Stripe\StripeClient;
use craft\base\Component;
use craft\elements\User;

class StripeService extends Component
{
    public const PAYMENT_METHOD_CACHE_KEY = 'stripe-payment-method-';

    protected $client;

    public function getOrCreateCustomer(User $user): Customer
    {
        if ($user->stripeCustomer) {
            return $this->getClient()->customers->retrieve(
                $user->stripeCustomer,
                []
            );
        } else {
            return $this->createCustomer($user);
        }
    }

    public function createCustomer(User $user): Customer
    {
        $customer = $this->getClient()->customers->create([
            'name' => $user->fullName,
            'email' => $user->email
        ]);
        $user->setFieldValue('stripeCustomer', $customer->id);
        \Craft::$app->elements->saveElement($user, false);
        return $customer;
    }

    public function createSetupIntent(User $user): SetupIntent
    {
        $customer = $this->getOrCreateCustomer($user);
        return $this->getClient()->setupIntents->create([
            'payment_method_types' => ['card'],
            'customer' => $customer->id
        ]);
    }

    public function savePaymentMethod(string $intentId): ?SetupIntent
    {
        $intent = $this->getClient()->setupIntents->retrieve($intentId);
        if ($intent->status == 'succeeded') {
            $user = \Craft::$app->user->identity;
            $user->setFieldValue('paymentMethod', $intent->payment_method);
            \Craft::$app->elements->saveElement($user, false);
            $this->clearPaymentMethodCache($user);
        }
        return $intent;
    }

    public function getPaymentMethod(User $user): ?PaymentMethod
    {
        if (!$user->paymentMethod or!$user->stripeCustomer) {
            return null;
        }
        $data = \Craft::$app->cache->get(self::PAYMENT_METHOD_CACHE_KEY . $user->id);
        if ($data === false) {
            $data = $this->getClient()->customers->retrievePaymentMethod($user->stripeCustomer, $user->paymentMethod);
            \Craft::$app->cache->set(self::PAYMENT_METHOD_CACHE_KEY . $user->id, $data, 86400);
        }
        return $data;
    }

    public function clearPaymentMethodCache(User $user)
    {
        \Craft::$app->cache->delete(self::PAYMENT_METHOD_CACHE_KEY . $user->id);
    }

    protected function getClient(): StripeClient
    {
        if ($this->client === null) {
            $this->client = new StripeClient(getenv('STRIPE_SECRET_KEY'));
        }
        return $this->client;
    }
}
