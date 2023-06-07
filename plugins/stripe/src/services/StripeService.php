<?php

namespace Plugins\Stripe\services;

use Stripe\Customer;
use Stripe\SetupIntent;
use Stripe\StripeClient;
use craft\base\Component;
use craft\elements\User;

class StripeService extends Component
{
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

    public function getPaymentMethods(User $user): array
    {
        if (!$user->stripeCustomer) {
            return [];
        }
        $methods = [];
        foreach ($this->getClient()->paymentMethods->all([
            'customer' => $user->stripeCustomer,
            'type' => 'card'
        ]) as $method) {
            $methods[] = $method;
        }
        return $methods;
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
        }
        return $intent;
    }

    protected function getClient(): StripeClient
    {
        if ($this->client === null) {
            $this->client = new StripeClient(getenv('STRIPE_SECRET_KEY'));
        }
        return $this->client;
    }
}
