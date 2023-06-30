<?php

namespace Plugins\Users\controllers;

use craft\web\Controller;

class UsersController extends Controller
{
    public function actionRefusedTimezoneChange()
    {
        \Craft::$app->session->set('refusedTimezoneChange', true);
    }
}
