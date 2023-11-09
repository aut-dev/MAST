<?php

namespace Plugins\Stripe\controllers;

use Plugins\Stripe\Stripe;
use craft\elements\Entry;
use craft\helpers\MoneyHelper;
use craft\web\Controller;
use yii\web\ForbiddenHttpException;

class StripeController extends Controller
{
    public function actionCreateCheckoutSession()
    {
        $this->requirePostRequest();
        $session = Stripe::$plugin->stripe->createSetupSession();
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

    public function actionRefund()
    {
        $this->requirePostRequest();
        $this->requireLogin();
        $id = $this->request->getRequiredParam('id');
        $user = \Craft::$app->user->identity;
        $daily = Entry::find()->authorId($user->id)->section('dailyTask')->id($id)->one();
        if (!$daily or $daily->refunded or !$daily->chargeId) {
            throw new ForbiddenHttpException();
        }
        if (Stripe::$plugin->stripe->refund($daily)) {
            \Craft::$app->session->setNotice(\Craft::t('site', 'We have refunded you {amount}', ['amount' => MoneyHelper::toString($daily->committed)]));
        } else {
            \Craft::$app->session->setError(\Craft::t('site', "We've been unable to refund you for this derail"));
        }
        return $this->redirect($daily->getTask()->url);
    }
}
