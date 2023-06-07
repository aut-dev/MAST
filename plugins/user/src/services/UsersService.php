<?php

namespace Plugins\Users\services;

use craft\base\Component;
use craft\elements\User;

class UsersService extends Component
{
    /**
     * Extra user validation rules
     *
     * @param User $user
     */
    public function validateUser(User $user)
    {
        if ($user->timezone and !in_array($user->timezone, \DateTimeZone::listIdentifiers())) {
            $user->addError('timezone', \Craft::t('site', 'Timezone is not valid'));
        }
    }
}
