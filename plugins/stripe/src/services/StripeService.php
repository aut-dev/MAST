<?php

namespace Plugins\Stripe\services;

use Plugins\Tasks\Tasks;
use Stripe\Customer;
use Stripe\Exception\CardException;
use Stripe\PaymentIntent;
use Stripe\PaymentMethod;
use Stripe\SetupIntent;
use Stripe\StripeClient;
use craft\base\Component;
use craft\elements\Entry;
use craft\elements\User;
use craft\helpers\MoneyHelper;

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

    public function chargeForDerail(Entry $task): bool
    {
        if (!$task->author->stripeCustomer or !$task->author->paymentMethod) {
            return false;
        }
        try {
            $amount = MoneyHelper::toNumber($task->committed) * 100;
            $this->getClient()->paymentIntents->create([
                'amount' => $amount,
                'currency' => 'usd',
                'customer' => $task->author->stripeCustomer,
                'payment_method' => $task->author->paymentMethod,
                'off_session' => true,
                'confirm' => true,
                'description' => 'Derail for task ' . $task->title
            ]);
            return true;
        } catch (CardException $e) {
            \Craft::$app->errorHandler->logException($e);
            $email = \Craft::$app->mailer->composeFromKey('admin_charge_failed', [
                'task' => $task,
                'amount' => $amount / 100,
                'user' => $task->author,
                'error' => $e->getMessage()
            ]);
            $email->setTo(Tasks::getAdminEmails())->send();
        }
        return false;
    }

    protected function getClient(): StripeClient
    {
        if ($this->client === null) {
            $this->client = new StripeClient(getenv('STRIPE_SECRET_KEY'));
        }
        return $this->client;
    }
}
