<?php

namespace Plugins\Stripe\controllers;

use Plugins\Stripe\Stripe;
use craft\web\Controller;

class StripeController extends Controller
{
    public function actionCreateSetupIntent()
    {
        $this->requireAcceptsJson();
        $this->requirePostRequest();
        $user = \Craft::$app->user->identity;
        $intent = Stripe::$plugin->stripe->createSetupIntent($user);
        return $this->asJson([
            'id' => $intent->id,
            'client_secret' => $intent->client_secret
        ]);
    }

    public function actionCardSaved()
    {
        $intent = Stripe::$plugin->stripe->savePaymentMethod(\Craft::$app->request->getRequiredParam('setup_intent'));
        if (!$intent) {
            throw new NotFoundHttpException('Intent not found');
        }
        switch ($intent->status) {
            case 'succeeded':
                return $this->redirect('card-saved');
            case 'processing':
                return $this->redirect('card-processing');
            case 'succeeded':
                \Craft::$app->session->setNotice(\Craft::t('site', 'Your card could not be saved, please try another one'));
                return $this->redirect('save-card');
        }
    }
}
