/* global $ Stripe Globals */

class SetupIntent
{
    $form;
    stripe;
    setupIntent;
    card;
    elements;

    constructor () 
    {
        this.$form = $('#card-form');
        this.stripe = Stripe(Globals.stripeKey);
        this.initSetupIntent();
        this.initSubmit();
        console.log('Setup intent initialised');
    }

    initSetupIntent()
    {
        $.ajax({
            url: '/?action=plugin-stripe/stripe/create-setup-intent',
            method: 'post',
            headers: {
                "X-CSRF-Token": Globals.csrfToken
            },
            dataType: 'json'
        }).done(data => {
            this.setupIntent = data;
            this.elements = this.stripe.elements({
                clientSecret: data.client_secret
            });
            this.elements.create('payment').mount('#card-element');
            this.$form.find('[type=submit]').show();
        });
    }

    initSubmit()
    {
        this.$form.submit((e) => {
            e.preventDefault();
            $('#card-errors').hide();
            this.$form.find('[type=submit]').attr('disabled', true);
            this.stripe.confirmSetup({
                elements: this.elements,
                confirmParams: {
                    return_url: Globals.return_url
                }
            }).then(result => {
                this.$form.find('[type=submit]').attr('disabled', false);
                if (result.error) {
                    $('#card-errors').html(result.error.message).show();
                }
            });
        });
    }
}

export { SetupIntent };