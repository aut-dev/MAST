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
            'cancel_url' => UrlHelper::siteUrl('my-account'),
        ]);
    }

    /**
     * Retrieve a portal session
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
            'stripeSessionId' => $sessionId,
            'lastChargeFailed' => false
        ]);
        \Craft::$app->elements->saveElement($user, false);
        $this->clearPaymentMethodCache($user);
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
            $user->setFieldValue('lastChargeFailed', false);
            \Craft::$app->elements->saveElement($user, false);
            $this->clearPaymentMethodCache($user);
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
     * @return array
     */
    public function chargeForDerail(Entry $task): array
    {
        $amount = MoneyHelper::toNumber($task->committed) * 100;
        if (!$task->author->stripeCustomer or !$task->author->paymentMethod) {
            if (!$task->author->paymentMethod) {
                $message = "User doesn't have a payment method";
            } else {
                $message = "User doesn't have a stripe id";
            }
            $this->sendAdminErrorEmail($task->author, $message);
            return [false, null];
        }
        try {
            $intent = $this->getClient()->paymentIntents->create([
                'amount' => $amount,
                'currency' => 'usd',
                'customer' => $task->author->stripeCustomer,
                'payment_method' => $task->author->paymentMethod,
                'payment_method_types' => ['card', 'link'],
                'off_session' => true,
                'confirm' => true,
                'description' => 'Derail for task ' . $task->title
            ]);
            $task->author->setFieldValue('lastChargeFailed', false);
            \Craft::$app->elements->saveElement($task->author, false);
            return [true, $intent];
        } catch (Exception $e) {
            \Craft::$app->errorHandler->logException($e);
            $task->author->setFieldValue('lastChargeFailed', true);
            \Craft::$app->elements->saveElement($task->author, false);
        }
        return [false, null];
    }

    /**
     * Refund for a daily task
     *
     * @param  Entry  $daily
     * @return bool
     */
    public function refund(Entry $daily): bool
    {
        try {
            $this->getClient()->refunds->create([
                'reason' => 'requested_by_customer',
                'charge' => $daily->chargeId
            ]);
        } catch (Exception $e) {
            \Craft::$app->errorHandler->logException($e);
            return false;
        }
        $daily->setFieldValue('refunded', true);
        \Craft::$app->elements->saveElement($daily, false);
        return true;
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

    /**
     * Send an error to the admins of the site
     *
     * @param  User $user
     * @param  string $message
     */
    protected function sendAdminErrorEmail(User $user, string $message): bool
    {
        return \Craft::$app->mailer->composeFromKey('admin_error', [
            'user' => $user,
            'error' => $message
        ])->setTo(Tasks::getAdminEmails())->send();
    }
}
