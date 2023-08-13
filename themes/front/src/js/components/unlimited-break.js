/* globals $ App */

class UnlimitedBreak
{
    $modal;
    modal;
    onChange;

    constructor(onChange)
    {
        this.onChange = onChange;
        this.$modal = $('#unlimited-break-modal');
        App.getBootstrap().then((bootstrap) => {
            this.modal = new bootstrap.Modal(document.getElementById('unlimited-break-modal'));
            this.initModal();
        });
    }

    initModal()
    {
        let $form = this.$modal.find('form');
        $form.submit(e => {
            e.preventDefault();
            $.ajax({
                url: '/',
                method: 'post',
                data: $form.serialize(),
                dataType: 'json'
            }).done(() => {
                if (this.onChange) {
                    this.onChange();
                }
                if ($form.find('[name=unlimitedBreak]').is(':checked')) {
                    App.addToast('Unlimited break is now on');
                    $('.js-unlimited-break').removeClass('text-body');
                    $('.unlimited-break-message').show();
                } else {
                    App.addToast('Unlimited break is now off');
                    $('.js-unlimited-break').addClass('text-body');
                    $('.unlimited-break-message').hide();
                }
                this.modal.hide();
            }).fail(response => {
                App.handleError(response, $form);
            }).always(() => {
                this.$modal.find('.spinner-border').hide();
                this.$modal.find('[type=submit]').attr('disabled', false);
            });
        });
    }
}

export { UnlimitedBreak };