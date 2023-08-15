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
        this.initImage();
        this.initTimeBased();
        this.initRecurring();
        console.log('Add task initialised');
    }

    initTimeBased()
    {
        this.toggleTimeBasedFields();
        $('.field-timeBased input[type=checkbox]').change(() => {
            this.toggleTimeBasedFields();
        });
    }

    initRecurring()
    {
        this.toggleRecurringFields();
        $('.field-recurring input[type=checkbox]').change(() => {
            this.toggleRecurringFields();
        });
    }

    initImage()
    {
        $('.js-delete-image').click((e) => {
            e.preventDefault();
            $(e.target).parent().replaceWith('<input type="hidden" name="fields[icon]" value="">');
        });
    }

    initWarningModal()
    {
        this.$warningModal.find('.js-continue').click(() => {
            this.$warningModal.find('.spinner-border').show();
            this.$warningModal.find('[type=submit]').attr('disabled', true);
            this.$form.submit();
        });
        this.$warningModal[0].addEventListener('hide.bs.modal', () => {
            this.$form.removeClass('derailed-checked');
            this.$form.find('.spinner-border').hide();
            this.$form.find('[type=submit]').attr('disabled', false);
        });
    }

    initLength()
    {
        $('.field-length input').keyup(() => {
            let minutes = parseInt($('.field-length input').val());
            if (isNaN(minutes)) {
                minutes = 10;
                $('.field-length input').val(10);
            }
            $('#length-seconds').val(minutes * 60);
        });
    }

    initWeeks()
    {
        this.$form.find('#repeat-input').change(() => {
            this.createWeeks();
        });
        this.createWeeks();
    }

    toggleTimeBasedFields()
    {
        if ($('.field-timeBased input[type=checkbox]').is(':checked')) {
            $('.field-length, .field-taskType').show();
        } else {
            $('.field-length, .field-taskType').hide();
            this.$form.find('.field-length input').val(10).trigger('keyup');
        }
    }

    toggleRecurringFields()
    {
        if ($('.field-recurring input[type=checkbox]').is(':checked')) {
            $('.field-repeat, .field-weeks').show();
        } else {
            $('.field-repeat, .field-weeks').hide();
        }
    }

    createWeeks()
    {
        let total = parseInt(this.$form.find('#repeat-input').val());
        if (total < 1) {
            total = 1;
            this.$form.find('#repeat-input').val(1);
        }
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
            if (!this.$form.hasClass('derailed-checked') && this.$form.find('[name=entryId]').val()) {
                e.preventDefault();
                this.$form.addClass('derailed-checked');
                $.ajax({
                    url: '/?action=plugin-tasks/tasks/check-edit-task',
                    method: 'post',
                    dataType: 'json',
                    data: this.$form.serialize()
                }).done((data) => {
                    if (data.status == 'derailed') {
                        this.warningModal.show();
                    } else {
                        this.$form.submit();
                    }
                });
            }
        });
    }
}

new AddTask;