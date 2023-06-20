<?php

namespace Plugins\Stripe\controllers;

use Plugins\Stripe\Stripe;
use Stripe\SetupIntent;
use craft\elements\User;
use craft\web\Controller;
use yii\web\ForbiddenHttpException;

class StripeController extends Controller
{
    protected array|bool|int $allowAnonymous = ['create-setup-intent', 'card-membership'];

    /**
     * Create a setup intent
     */
    public function actionCreateSetupIntent()
    {
        $this->requireAcceptsJson();
        $this->requirePostRequest();
        $user = \Craft::$app->user->identity;
        if (!$user) {
            $user = $this->getUserFromSession();
        }
        $intent = Stripe::$plugin->stripe->createSetupIntent($user);
        return $this->asJson([
            'id' => $intent->id,
            'client_secret' => $intent->client_secret
        ]);
    }

    /**
     * Callback for setup intent, for membership
     */
    public function actionCardMembership()
    {
        $user = \Craft::$app->user->identity;
        if (!$user) {
            $user = $this->getUserFromSession();
        }
        $intent = Stripe::$plugin->stripe->savePaymentMethod(\Craft::$app->request->getRequiredParam('setup_intent'), $user);
        if (!$intent) {
            throw new NotFoundHttpException('Intent not found');
        }
        switch ($intent->status) {
            case 'succeeded':
                if (Stripe::$plugin->stripe->chargeForMembership($user)) {
                    \Craft::$app->session->setNotice(\Craft::t('site', 'Your membership is now active'));
                    \Craft::$app->session->remove('membership-user-id');
                    return $this->redirect('tasks');
                } else {
                    \Craft::$app->session->setNotice(\Craft::t('site', 'We\'ve been unable to charge your card, please try another one'));
                    return $this->redirect('pay-membership');
                }
                // no break
            case 'processing':
                return $this->redirect('card-processing');
            case 'payment_failed':
                \Craft::$app->session->setNotice(\Craft::t('site', 'Payment for the membership has failed, please try another card'));
                return $this->redirect('pay-membership');
        }
    }

    public function actionCardSaved()
    {
        $user = \Craft::$app->user->identity;
        $intent = Stripe::$plugin->stripe->savePaymentMethod(\Craft::$app->request->getRequiredParam('setup_intent'), $user);
        if (!$intent) {
            throw new NotFoundHttpException('Intent not found');
        }
        switch ($intent->status) {
            case 'succeeded':
                \Craft::$app->session->setNotice(\Craft::t('site', 'Your card has been saved'));
                return $this->redirect('tasks');
            case 'processing':
                return $this->redirect('card-processing');
            case 'payment_failed':
                \Craft::$app->session->setNotice(\Craft::t('site', 'Your card could not be saved, please try another one'));
                return $this->redirect('save-card');
        }
    }

    protected function getUserFromSession(): User
    {
        $userId = \Craft::$app->session->get('membership-user-id');
        if (!$userId) {
            throw new ForbiddenHttpException('User id not found');
        }
        $user = User::find()->id($userId)->one();
        if (!$user) {
            throw new ForbiddenHttpException('User not found');
        }
        return $user;
    }
}
