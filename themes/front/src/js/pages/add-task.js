/* global $ App */

class AddTask
{
    $form;

    constructor () 
    {
        console.log('Add task initialised');
        this.$form = $('#add-task-form');
        this.initSubmit();
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