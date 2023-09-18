<?php

namespace Plugins\Stripe\services;

use DateInterval;
use DateTime;
use Exception;
use Plugins\Stripe\exceptions\StripeException;
use Plugins\Tasks\Tasks;
use Stripe\BillingPortal\Session as PortalSession;
use Stripe\Checkout\Session;
use Stripe\Customer;
use Stripe\Exception\ApiErrorException;
use Stripe\PaymentIntent;
use Stripe\PaymentMethod;
use Stripe\SetupIntent;
use Stripe\Stripe;
use Stripe\StripeClient;
use Stripe\Subscription;
use craft\base\Component;
use craft\elements\Entry;
use craft\elements\User;
use craft\helpers\MoneyHelper;
use craft\helpers\UrlHelper;
use yii\caching\TagDependency;

class StripeService extends Component
{
    public const PAYMENT_METHOD_CACHE_KEY = 'stripe-payment-method-';

    protected $_client;

    /**
     * Get Stripe client
     *
     * @return StripeClient
     */
    public function getClient(): StripeClient
    {
        if ($this->_client === null) {
            $this->_client = new StripeClient(getenv('STRIPE_SECRET_KEY'));
        }
        return $this->_client;
    }

    /**
     * Create a checkout session in subscription mode
     *
     * @return Session
     */
    public function createSubscriptionSession(): Session
    {
        $user = \Craft::$app->user->identity;
        return $this->getClient()->checkout->sessions->create([
            'line_items' => [[
                'price' => getenv('STRIPE_PRICE_ID'),
                'quantity' => 1,
            ]],
            'customer' => $this->getCustomerId($user),
            "payment_method_types" => ["card", "link"],
            'mode' => 'subscription',
            'success_url' => UrlHelper::siteUrl('stripe-subscription-success?session_id={CHECKOUT_SESSION_ID}'),
            'cancel_url' => UrlHelper::siteUrl('my-account'),
        ]);
    }

    /**
     * Create a checkout session in setup mode
     *
     * @return Session
     */
    public function createSetupSession(): Session
    {
        $user = \Craft::$app->user->identity;
        return $this->getClient()->checkout->sessions->create([
            'customer' => $this->getCustomerId($user),
            "payment_method_types" => ["card", "link"],
            'mode' => 'setup',
            'success_url' => UrlHelper::siteUrl('stripe-setup-success?session_id={CHECKOUT_SESSION_ID}'),
            'cancel_url' => UrlHelper::siteUrl('save-card'),
        ]);
    }

    /**
     * Create a portal session for a subscription
     *
     * @param  User   $user
     * @return PortalSession
     */
    public function retrievePortalSession(): PortalSession
    {
        $user = \Craft::$app->user->identity;
        $session = $this->getClient()->checkout->sessions->retrieve($user->stripeSessionId);
        return $this->getClient()->billingPortal->sessions->create([
            'customer' => $session->customer,
            'return_url' => UrlHelper::siteUrl('my-account'),
        ]);
    }

    /**
     * Retrieve a setup session and save the payment method associated
     *
     * @param  string $sessionId
     */
    public function saveSetupFromSession(string $sessionId)
    {
        $session = $this->getClient()->checkout->sessions->retrieve($sessionId, [
            'expand' => ['setup_intent']
        ]);
        $user = \Craft::$app->user->identity;
        $user->setFieldValues([
            'paymentMethod' => $session->setup_intent->payment_method,
            'stripeSessionId' => $sessionId
        ]);
        \Craft::$app->elements->saveElement($user, false);
    }

    /**
     * Retrieve a subscription session and save the subscription status
     *
     * @param  string $sessionId
     */
    public function saveSubscriptionFromSession(string $sessionId)
    {
        $session = $this->getClient()->checkout->sessions->retrieve($sessionId, [
            'expand' => ['subscription']
        ]);
        $user = \Craft::$app->user->identity;
        $user->setFieldValue('stripeSessionId', $sessionId);
        if (!$user->paymentMethod) {
            $user->setFieldValue('paymentMethod', $session->subscription->default_payment_method);
        }
        $this->updateUserSubscription($user, $session->subscription);
    }

    /**
     * Update/Create the subscription
     *
     * @param  Subscription $subscription
     */
    public function updateSubscription(Subscription $subscription)
    {
        if ($user = $this->findUser($subscription)) {
            $this->updateUserSubscription($user, $subscription);
        }
    }

    /**
     * Update the customer
     *
     * @param  Customer $customer
     */
    public function updateCustomer(Customer $customer)
    {
        $user = User::find()->stripeCustomer($customer->id)->anyStatus()->one();
        if ($user and $customer->invoice_settings['default_payment_method']) {
            $user->setFieldValue('paymentMethod', $customer->invoice_settings['default_payment_method']);
            \Craft::$app->elements->saveElement($user, false);
            $this->clearPaymentMethodCache($user);
        }
    }

    /**
     * Delete the subscription
     *
     * @param  Subscription $subscription
     */
    public function deleteSubscription(Subscription $subscription)
    {
        if ($user = $this->findUser($subscription)) {
            $this->updateUserSubscription($user, null);
        }
    }

    /**
     * Get a user stripe payment method, the result will be cached for a day
     *
     * @param  User   $user
     * @return ?PaymentMethod
     */
    public function getPaymentMethod(User $user): ?PaymentMethod
    {
        if (!$user->paymentMethod or !$user->stripeCustomer) {
            return null;
        }
        $data = \Craft::$app->cache->get(self::PAYMENT_METHOD_CACHE_KEY . $user->id);
        if ($data === false) {
            try {
                $data = $this->getClient()->customers->retrievePaymentMethod($user->stripeCustomer, $user->paymentMethod);
            } catch (\Exception $e) {
                return null;
            }
            $dep = new TagDependency([
                'tags' => [self::PAYMENT_METHOD_CACHE_KEY]
            ]);
            \Craft::$app->cache->set(self::PAYMENT_METHOD_CACHE_KEY . $user->id, $data, 86400, $dep);
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
     * Charge for a daily task derail
     *
     * @param  Entry  $task
     * @return bool
     */
    public function chargeForDerail(Entry $task): bool
    {
        $amount = MoneyHelper::toNumber($task->committed) * 100;
        if (!$task->author->stripeCustomer or !$task->author->paymentMethod) {
            $this->sendChargeFailAdminEmail($task, $amount, "User " . $task->author->email . " cannot be charged, it's missing a stripe customer id or a payment method id.");
            return false;
        }
        try {
            $this->getClient()->paymentIntents->create([
                'amount' => $amount,
                'currency' => 'usd',
                'customer' => $task->author->stripeCustomer,
                'payment_method' => $task->author->paymentMethod,
                'payment_method_types' => ['card', 'link'],
                'off_session' => true,
                'confirm' => true,
                'description' => 'Derail for task ' . $task->title
            ]);
            return true;
        } catch (Exception $e) {
            \Craft::$app->errorHandler->logException($e);
            $this->sendChargeFailAdminEmail($task, $amount, $e->getMessage());
        }
        return false;
    }

    /**
     * Send an error to the admins of the site
     *
     * @param  Entry  $task
     * @param  float  $amount
     * @param  string $message
     */
    protected function sendChargeFailAdminEmail(Entry $task, float $amount, string $message): bool
    {
        return \Craft::$app->mailer->composeFromKey('admin_derail_charge_failed', [
            'task' => $task,
            'amount' => $amount / 100,
            'user' => $task->author,
            'error' => $message
        ])->setTo(Tasks::getAdminEmails())->send();
    }

    /**
     * Update a user subscription internal values
     *
     * @param  User         $user
     * @param  ?Subscription $subscription
     */
    protected function updateUserSubscription(User $user, ?Subscription $subscription)
    {
        $values = [
            'subscriptionStatus' => null,
            'subscriptionExpires' => null,
            'cancelAtPeriodEnd' => false
        ];
        if ($subscription) {
            $values = [
                'subscriptionStatus' => $subscription->status,
                'cancelAtPeriodEnd' => $subscription->cancel_at_period_end,
                'subscriptionExpires' => $subscription->current_period_end ? (new DateTime())->setTimestamp($subscription->current_period_end) : null
            ];
        }
        $user->setFieldValues($values);
        \Craft::$app->elements->saveElement($user, false);
        $this->clearPaymentMethodCache($user);
    }

    /**
     * Find a user from a subscription, first by stripe id, then by email
     *
     * @param  Subscription $subscription
     * @return ?User
     */
    protected function findUser(Subscription $subscription): ?User
    {
        $user = User::find()->stripeCustomer($subscription->customer)->anyStatus()->one();
        if (!$user) {
            $customer = $this->getClient()->customers->retrieve($subscription->customer);
            $user = User::find()->email($customer->email)->anyStatus()->one();
        }
        return $user;
    }

    /**
     * Get (or create) a stripe customer id for a user
     *
     * @param  User   $user
     * @return string
     */
    protected function getCustomerId(User $user): string
    {
        if ($user->stripeCustomer) {
            return $user->stripeCustomer;
        }
        $customer = $this->getClient()->customers->create([
            'email' => $user->email,
            'name' => $user->fullName
        ]);
        $user->setFieldValue('stripeCustomer', $customer->id);
        \Craft::$app->elements->saveElement($user, false);
        return $customer->id;
    }
}
