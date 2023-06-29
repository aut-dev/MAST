<?php

namespace Plugins\Stripe\controllers;

use Plugins\Stripe\Stripe;
use Stripe\Checkout\Session;
use Stripe\Price;
use Stripe\SetupIntent;
use craft\elements\User;
use craft\web\Controller;
use yii\web\ForbiddenHttpException;

class StripeController extends Controller
{
    public function actionCreateCheckoutSession()
    {
        $this->requirePostRequest();
        $session = Stripe::$plugin->stripe->createCheckoutSession(\Craft::$app->user->identity);
        return $this->redirect($session->url);
    }

    public function actionCreatePortalSession()
    {
        $this->requirePostRequest();
        $session = Stripe::$plugin->stripe->createPortalSession(\Craft::$app->user->identity);
        return $this->redirect($session->url);
    }

    public function actionSubscriptionSuccess()
    {
        $session_id = $this->request->getRequiredParam('session_id');
        $user = \Craft::$app->user->identity;
        $user->setFieldValue('stripeSessionId', $session_id);
        \Craft::$app->elements->saveElement($user, false);
        return $this->redirect('my-account?subscription_paid=1');
    }
}
