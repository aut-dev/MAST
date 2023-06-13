/* global $ App Globals */

import '../../css/app/components/tasks.scss';

class Tasks
{
    $modal;
    modal;

    constructor () 
    {
        this.$modal = $('#delete-task-modal');
        App.getBootstrap().then((bootstrap) => {
            this.modal = new bootstrap.Modal(document.getElementById('delete-task-modal'));
            this.initModal();
        });
        this.initDeleteLinks();
        console.log('Tasks initialised');
    }

    initDeleteLinks()
    {
        $('.js-delete-task').click(e => {
            this.$modal.find('.js-delete').data('id', $(e.currentTarget).data('id'));
        });
    }

    initModal()
    {
        this.$modal.find('.js-delete').click((e) => {
            this.deleteTask($(e.currentTarget).data('id'));
        });
    }

    deleteTask(id)
    {
        if (id) {
            $.ajax({
                url: '/',
                method: 'post',
                data: {
                    action: 'entries/save-entry',
                    entryId: id,
                    enabled: 0
                },
                dataType: 'json',
                headers: {
                    "X-CSRF-Token": Globals.csrfToken
                }
            }).done(() => {
                $('.task[data-id=' + id + ']').parent().remove();
                this.modal.hide();
            });
        }
    }
}

new Tasks;