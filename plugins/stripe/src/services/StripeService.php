<?php

namespace Plugins\Stripe\services;

use DateInterval;
use DateTime;
use Plugins\Tasks\Tasks;
use Stripe\BillingPortal\Session as PortalSession;
use Stripe\Checkout\Session;
use Stripe\Customer;
use Stripe\Exception\ApiErrorException;
use Stripe\Exception\CardException;
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

    public function createCheckoutSession(User $user): Session
    {
        return $this->getClient()->checkout->sessions->create([
            'line_items' => [[
                'price' => getenv('STRIPE_PRICE_ID'),
                'quantity' => 1,
            ]],
            'customer_email' => $user->email,
            // 'payment_intent_data' => [
            //     'setup_future_usage' => 'off_session'
            // ],
            'mode' => 'subscription',
            'success_url' => UrlHelper::siteUrl('stripe-subscription-success?session_id={CHECKOUT_SESSION_ID}'),
            'cancel_url' => UrlHelper::siteUrl('pay-subscription'),
        ]);
    }

    public function createPortalSession(User $user): PortalSession
    {
        $session = $this->getClient()->checkout->sessions->retrieve($user->stripeSessionId);
        return $this->getClient()->billingPortal->sessions->create([
            'customer' => $session->customer,
            'return_url' => UrlHelper::siteUrl('my-account'),
        ]);
    }

    public function updateSubscription(Subscription $subscription)
    {
        $customer = $this->getClient()->customers->retrieve($subscription->customer);
        if (!$customer->email) {
            throw StripeException("Customer doesn't have an email");
        }
        $user = User::find()->email($customer->email)->anyStatus()->one();
        if (!$user) {
            throw StripeException("User with email {$customer->email} doesn't exist");
        }
        $user->setFieldValues([
            'stripeCustomer' => $subscription->customer,
            'paymentMethod' => $subscription->default_payment_method ?? '',
            'subscriptionStatus' => $subscription->status,
            'subscriptionExpires' => $subscription->current_period_end ? (new DateTime())->setTimestamp($subscription->current_period_end) : null
        ]);
        \Craft::$app->elements->saveElement($user, false);
    }

    public function deleteSubscription(Subscription $subscription)
    {
        $customer = $this->getClient()->customers->retrieve($subscription->customer);
        if (!$customer->email) {
            throw StripeException("Customer doesn't have an email");
        }
        $user = User::find()->email($customer->email)->anyStatus()->one();
        if (!$user) {
            throw StripeException("User with email {$customer->email} doesn't exist");
        }
        $user->setFieldValues([
            'subscriptionStatus' => null,
            'subscriptionExpires' => null,
            'paymentMethod' => null
        ]);
        \Craft::$app->elements->saveElement($user, false);
    }

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
}
