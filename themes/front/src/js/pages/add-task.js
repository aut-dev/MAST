/* global $ App */

class AddTask
{
    $form;

    constructor () 
    {
        console.log('Add task initialised');
        this.$form = $('#add-task-form');
        this.initSubmit();
        this.initTimezones();
        this.initUntil();
    }

    initUntil()
    {
        this.$form.find('#repeat').change((e) => {
            if ($(e.currentTarget).val()) {
                this.$form.find('.field-until').slideDown();
            } else {
                this.$form.find('.field-until').slideUp();
            }
        });
    }

    initTimezones()
    {
        this.$form.find('input.timezone').val(Intl.DateTimeFormat().resolvedOptions().timeZone);
    }

    initSubmit()
    {
        this.$form.submit((e) => {
            e.preventDefault();
            $.ajax({
                url: '/',
                method: 'post',
                data: this.$form.serialize()
            }).fail(response => {
                App.handleError(response, this.$form);
            }).done(data => {
                window.location.href = data.redirect;
            });
        });
    }
}

new AddTask;