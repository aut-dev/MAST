/* global $ App Globals */

import 'jquery-ui/themes/base/core.css';
import 'jquery-ui/themes/base/theme.css';
import 'jquery-ui/ui/core';
import 'jquery-ui/ui/widgets/sortable';
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
        this.initSortable();
        console.log('Tasks initialised');
    }

    initSortable()
    {
        $('#sortable').sortable({
            handle: ".handle",
            stop: this.updatePositions
        });
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

    updatePositions()
    {
        let data = [];
        $.each($('.task'), (i, item) => {
            data.push({
                id: $(item).data('id'),
                order: i
            });
        });
        $.ajax({
            method: 'post',
            url: '/?action=plugin-tasks/tasks/reorder',
            data: {
                data: data
            },
            headers: {
                "X-CSRF-Token": Globals.csrfToken
            }
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