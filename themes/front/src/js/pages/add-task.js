/* global $ App */

import '../../css/app/components/add-task.scss';

class AddTask
{
    $form;
    $modal;
    modal;
    warningModal;
    $warningModal;

    constructor () 
    {
        this.$form = $('#add-task-form');
        this.$modal = $('#delete-task-modal');
        this.$warningModal = $('#warning-task-modal');
        if (this.$modal.length) {
            App.getBootstrap().then((bootstrap) => {
                this.modal = new bootstrap.Modal(document.getElementById('delete-task-modal'));
                this.warningModal = new bootstrap.Modal(document.getElementById('warning-task-modal'));
                this.initWarningModal();
            });
        }
        this.initSubmit();
        this.initWeeks();
        this.initLength();
        console.log('Add task initialised');
    }

    initWarningModal()
    {
        this.$warningModal.find('.js-continue').click(() => {
            this.submit();
        });
    }

    initLength()
    {
        $('#length').keyup(() => {
            let seconds = parseInt($('#length').val());
            if (!isNaN(seconds)) {
                $('#length-seconds').val(seconds * 60);
            }
        });
    }

    initWeeks()
    {
        this.$form.find('#repeat-input').change(() => {
            this.createWeeks();
        });
        this.createWeeks();
    }

    createWeeks()
    {
        let total = parseInt(this.$form.find('#repeat-input').val());
        let existing = this.$form.find('.field-weeks .week');
        while (total < existing.length) {
            existing.last().remove();
            existing = this.$form.find('.field-weeks .week');
        }
        while (total > existing.length) {
            this.$form.find('.field-weeks').append(this.createWeek());
            existing = this.$form.find('.field-weeks .week');
        }
    }

    createWeek()
    {
        let week = this.$form.find('.field-weeks .week').first().clone();
        let index = 'new' + (this.$form.find('.field-weeks .week').length + 1);
        let namespace = 'fields[weeks][' + index + ']';
        week.find('.type').attr('name', namespace + '[type]');
        week.find('.enabled').attr('name', namespace + '[enabled]');
        $.each(week.find('.day'), (i, item) => {
            $(item).attr('name', namespace + '[fields][' + $(item).data('day') + ']').val(1);
        });
        return week;
    }

    initSubmit()
    {
        this.$form.submit((e) => {
            e.preventDefault();
            if (this.$form.find('[name=entryId]').val()) {
                $.ajax({
                    url: '/?action=plugin-tasks/tasks/check-edit-task',
                    method: 'post',
                    dataType: 'json',
                    data: this.$form.serialize()
                }).done((data) => {
                    if (data.status == 'derailed') {
                        this.warningModal.show();
                    } else {
                        this.submit();
                    }
                });
            } else {
                this.submit();
            }
        });
    }

    submit()
    {
        $.ajax({
            url: '/',
            method: 'post',
            dataType: 'json',
            data: this.$form.serialize()
        }).fail(response => {
            App.handleError(response, this.$form);
        }).done(data => {
            window.location.href = data.redirect;
        });
    }
}

new AddTask;