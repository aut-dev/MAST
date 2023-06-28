/* global $ */

class MyAccount
{
    $form;
    newEmail = false;
    newPassword = false;

    constructor () 
    {
        this.$form = $('#profile-form');
        this.initForm();
        console.log('My account initialised');
    }

    initForm()
    {
        let $email = this.$form.find('[name=email]');
        $email.keyup(() => {
            this.newEmail = false;
            if ($email.val() != $email.data('current')) {
                this.newEmail = true;
            }
            this.toggleNewPassword();
        });
        let $pass = this.$form.find('[name=newPassword]')
        $pass.keyup(() => {
            this.newPassword = false;
            if ($pass.val()) {
                this.newPassword = true;
            }
            this.toggleNewPassword();
        });
    }

    toggleNewPassword()
    {
        let $newpass = this.$form.find('#current-password-field');
        if (this.newEmail || this.newPassword) {
            $newpass.slideDown('fast');
        } else {
            $newpass.slideUp('fast');
        }
    }
}

new MyAccount;