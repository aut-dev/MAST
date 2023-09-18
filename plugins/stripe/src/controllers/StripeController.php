<?php

namespace Plugins\Stripe\controllers;

use Plugins\Stripe\Stripe;
use craft\web\Controller;

class StripeController extends Controller
{
    public function actionCreateCheckoutSession()
    {
        $this->requirePostRequest();
        $mode = $this->request->getRequiredParam('mode');
        if ($mode == 'subscription') {
            $session = Stripe::$plugin->stripe->createSubscriptionSession();
        } else {
            $session = Stripe::$plugin->stripe->createSetupSession();
        }
        return $this->redirect($session->url);
    }

    public function actionRetrievePortalSession()
    {
        $this->requirePostRequest();
        $session = Stripe::$plugin->stripe->retrievePortalSession();
        return $this->redirect($session->url);
    }

    public function actionSetupSuccess()
    {
        $session_id = $this->request->getRequiredParam('session_id');
        Stripe::$plugin->stripe->saveSetupFromSession($session_id);
        \Craft::$app->session->setSuccess('Card has been saved');
        return $this->redirect('my-account');
    }

    public function actionSubscriptionSuccess()
    {
        $session_id = $this->request->getRequiredParam('session_id');
        Stripe::$plugin->stripe->saveSubscriptionFromSession($session_id);
        return $this->redirect('my-account?subscription_paid=1');
    }
}
