<?php

namespace Plugins\Stripe\services;

use DateInterval;
use Plugins\Tasks\Tasks;
use Stripe\Customer;
use Stripe\Exception\ApiErrorException;
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

    /**
     * Get or create the Stripe customer for a user
     *
     * @param  User   $user
     * @return Customer
     */
    public function getOrCreateCustomer(User $user): Customer
    {
        if ($user->stripeCustomer) {
            try {
                return $this->getClient()->customers->retrieve(
                    $user->stripeCustomer,
                    []
                );
            } catch (ApiErrorException $e) {
                return $this->createCustomer($user);
            }
        }
        return $this->createCustomer($user);
    }

    /**
     * Create a setup intent
     *
     * @param  User   $user
     * @return SetupIntent
     */
    public function createSetupIntent(User $user): SetupIntent
    {
        $customer = $this->getOrCreateCustomer($user);
        return $this->getClient()->setupIntents->create([
            'payment_method_types' => ['card'],
            'customer' => $customer->id,
        ]);
    }

    /**
     * Saves a user payment method
     *
     * @param  string $intentId
     * @param  User   $user
     * @return ?SetupIntent
     */
    public function savePaymentMethod(string $intentId, User $user): ?SetupIntent
    {
        $intent = $this->getClient()->setupIntents->retrieve($intentId);
        if ($intent->status == 'succeeded') {
            $user->setFieldValue('paymentMethod', $intent->payment_method);
            \Craft::$app->elements->saveElement($user, false);
            $this->clearPaymentMethodCache($user);
        }
        return $intent;
    }

    /**
     * Charge a user for its membership
     *
     * @param  User   $user
     * @return bool
     */
    public function chargeForMembership(User $user): bool
    {
        if (!$user->stripeCustomer or !$user->paymentMethod) {
            return false;
        }
        try {
            $amount = Entry::find()->section('membership')->one()->monthlyCost->getAmount();
            $this->getClient()->paymentIntents->create([
                'amount' => $amount,
                'currency' => 'usd',
                'customer' => $user->stripeCustomer,
                'payment_method' => $user->paymentMethod,
                'off_session' => true,
                'confirm' => true,
                'description' => 'Monthly membership'
            ]);
            $user->setFieldValues([
                'membershipExpires' => (clone $user->now)->setTime(0, 0, 0)->add(new DateInterval('P1M'))
            ]);
            \Craft::$app->elements->saveElement($user, false);
            return true;
        } catch (CardException $e) {
            \Craft::$app->errorHandler->logException($e);
            $email = \Craft::$app->mailer->composeFromKey('admin_membership_charge_failed', [
                'amount' => $amount / 100,
                'user' => $user,
                'error' => $e->getMessage()
            ]);
            $email->setTo(Tasks::getAdminEmails())->send();
        }
        return false;
    }

    /**
     * Get a user stripe payment method, the result will be cached for a day
     *
     * @param  User   $user
     * @return ?PaymentMethod
     */
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

    /**
     * Clear a userpayment method cache
     *
     * @param  User   $user
     */
    public function clearPaymentMethodCache(User $user)
    {
        \Craft::$app->cache->delete(self::PAYMENT_METHOD_CACHE_KEY . $user->id);
    }

    /**
     * Charge for a task derail
     *
     * @param  Entry  $task
     * @return bool
     */
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
            $email = \Craft::$app->mailer->composeFromKey('admin_derail_charge_failed', [
                'task' => $task,
                'amount' => $amount / 100,
                'user' => $task->author,
                'error' => $e->getMessage()
            ]);
            $email->setTo(Tasks::getAdminEmails())->send();
        }
        return false;
    }

    /**
     * Create a stripe customer
     *
     * @param  User   $user
     * @return Customer
     */
    protected function createCustomer(User $user): Customer
    {
        $customer = $this->getClient()->customers->create([
            'name' => $user->fullName,
            'email' => $user->email
        ]);
        $user->setFieldValue('stripeCustomer', $customer->id);
        \Craft::$app->elements->saveElement($user, false);
        return $customer;
    }

    /**
     * Get Stripe client
     *
     * @return StripeClient
     */
    protected function getClient(): StripeClient
    {
        if ($this->client === null) {
            $this->client = new StripeClient(getenv('STRIPE_SECRET_KEY'));
        }
        return $this->client;
    }
}
