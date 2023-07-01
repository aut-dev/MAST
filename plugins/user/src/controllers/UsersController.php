<?php

namespace Plugins\Users\controllers;

use craft\web\Controller;

class UsersController extends Controller
{
    /**
     * Saves in session that user refused to change timezone
     */
    public function actionRefusedTimezoneChange()
    {
        \Craft::$app->session->set('refusedTimezoneChange', true);
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
}
