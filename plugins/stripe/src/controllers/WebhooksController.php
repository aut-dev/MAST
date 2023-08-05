<?php

namespace Plugins\Stripe\controllers;

use Plugins\Stripe\Stripe;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Exception\UnexpectedValueException;
use Stripe\Webhook;
use craft\web\Controller;

class WebhooksController extends Controller
{
    protected array|bool|int $allowAnonymous = self::ALLOW_ANONYMOUS_LIVE | self::ALLOW_ANONYMOUS_OFFLINE;
    public $enableCsrfValidation = false;

    public function actionSubscriptionChanged()
    {
        $payload = $this->request->getRawBody();
        $secret = getenv('STRIPE_SUBSCRIPTION_WEBHOOK_SECRET');
        $header = $_SERVER['HTTP_STRIPE_SIGNATURE'];
        try {
            $event = Webhook::constructEvent($payload, $header, $secret);
        } catch (UnexpectedValueException $e) {
            $this->response->setStatusCode(400);
            return null;
        } catch (SignatureVerificationException $e) {
            $this->response->setStatusCode(400);
            return null;
        }

        switch ($event->type) {
            case 'customer.subscription.created':
                Stripe::$plugin->stripe->updateSubscription($event->data->object);
                break;
            case 'customer.subscription.deleted':
                Stripe::$plugin->stripe->deleteSubscription($event->data->object);
                break;
            case 'customer.subscription.updated':
                Stripe::$plugin->stripe->updateSubscription($event->data->object);
                // no break
            case 'customer.updated':
                Stripe::$plugin->stripe->updateCustomer($event->data->object);
        }
        return '';
    }
}
