<?php

namespace Plugins\Users\controllers;

use craft\web\Controller;

class UsersController extends Controller
{
    protected array|bool|int $allowAnonymous = ['check-session'];

    /**
     * Saves in session that user refused to change timezone
     */
    public function actionRefusedTimezoneChange()
    {
        \Craft::$app->session->set('refusedTimezoneChange', true);
    }

    /**
     * Changes user hide inactive tasks switch
     */
    public function actionSetHideInactiveTasks()
    {
        $user = \Craft::$app->user->identity;
        $user->setFieldValue('hideInactiveTasks', $this->request->getRequiredParam('hideInactiveTasks'));
        \Craft::$app->elements->saveElement($user, false);
        return $this->asJson([]);
    }

    /**
     * Changes user timezone
     */
    public function actionChangeTimezone()
    {
        $timezone = $this->request->getRequiredParam('timezone');
        $user = \Craft::$app->user->identity;
        $user->setFieldValue('timezone', $timezone);
        \Craft::$app->elements->saveElement($user, false);
        return $this->asJson([]);
    }

    /**
     * Check if user has an active session
     */
    public function actionCheckSession()
    {
        return $this->asJson([
            'session' => \Craft::$app->user->getId() ? true : false
        ]);
    }
}
