/* global $ App */

class MyAccount {
  $accountForm;
  $passwordForm;
  passwordModal;
  newEmail = false;

  constructor() {
    this.$accountForm = $("#profile-form");
    this.$passwordForm = $("#password-form");
    this.initAccountForm();
    this.initPasswordForm();
    App.getBootstrap().then((bootstrap) => {
      this.passwordModal = new bootstrap.Modal(
        document.getElementById("change-password-modal"),
      );
    });
    console.log("My account initialised");
  }

  initPasswordForm() {
    this.$passwordForm.submit((e) => {
      e.preventDefault();
      $.ajax({
        url: "/",
        method: "post",
        dataType: "json",
        data: this.$passwordForm.serialize(),
      })
        .done(() => {
          App.addToast("Your password has been changed");
          this.passwordModal.hide();
          this.$passwordForm.reset();
        })
        .fail((response) => {
          App.handleError(response, this.$passwordForm);
        });
    });
  }

  initAccountForm() {
    let $email = this.$accountForm.find("[name=email]");
    $email.keyup(() => {
      this.newEmail = false;
      if ($email.val() != $email.data("current")) {
        this.newEmail = true;
      }
      this.toggleNewPassword();
    });
  }

  toggleNewPassword() {
    let $newpass = this.$accountForm.find("#current-password-field");
    if (this.newEmail) {
      $newpass.slideDown("fast");
    } else {
      $newpass.slideUp("fast");
    }
  }
}

new MyAccount();
