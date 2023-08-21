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
        this.toggleFields();
        $('.field-timeBased input[type=checkbox]').change(() => {
            this.toggleFields();
        });
    }

    initRecurring()
    {
        this.toggleFields();
        $('.field-recurring input[type=checkbox]').change(() => {
            this.toggleFields();
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
        let $input = this.$form.find('.field-length input');
        $input.keyup(() => {
            let minutes = parseInt($input.val());
            if (!isNaN(minutes)) {
                this.$form.find('#length-seconds').val(minutes * 60);
            }
        });
    }

    initWeeks()
    {
        this.$form.find('#repeat-input').keyup(() => {
            this.createWeeks();
        });
        this.createWeeks();
    }

    toggleFields()
    {
        if ($('.field-timeBased input[type=checkbox]').is(':checked')) {
            $('.field-length, .field-taskType, .field-weeks').show();
            $('.field-weeksToggle').hide();
        } else {
            $('.field-length, .field-taskType, .field-weeks').hide();
            $('.field-weeksToggle').show();
            this.$form.find('.field-length input').val(10).trigger('keyup');
        }
        if ($('.field-recurring input[type=checkbox]').is(':checked')) {
            $('.field-repeat').show();
        } else {
            $('.field-repeat, .field-weeks, .field-weeksToggle').hide();
        }
    }

    createWeeks()
    {
        let $input = this.$form.find('#repeat-input');
        let total = parseInt($input.val());
        if (isNaN(total)) {
            return;
        }
        if (total < 1) {
            total = 1;
            $input.val(1);
        }
        let selector = '.field-weeksToggle .week';
        let field = '.field-weeksToggle';
        let name = 'weeksToggle';
        if ($('.field-timeBased input[type=checkbox]').is(':checked')) {
            selector = '.field-weeks .week';
            field = 'field-weeks';
            name = 'weeks';
        }
        let existing = this.$form.find(selector);
        while (total < existing.length) {
            existing.last().remove();
            existing = this.$form.find(selector);
        }
        while (total > existing.length) {
            this.$form.find(field).append(this.createWeek(selector, name));
            existing = this.$form.find(selector);
        }
    }

    createWeek(selector, name)
    {
        let week = this.$form.find(selector).first().clone();
        let index = 'new' + (this.$form.find(selector).length + 1);
        let namespace = 'fields[' + name + '][' + index + ']';
        week.find('.type').attr('name', namespace + '[type]');
        week.find('.enabled').attr('name', namespace + '[enabled]');
        $.each(week.find('.day'), (i, item) => {
            if (name == 'weeks') {
                $(item).attr('name', namespace + '[fields][' + $(item).data('day') + ']').val(1);
            } else {
                $(item).attr('name', namespace + '[fields][' + $(item).data('day') + ']').attr('checked', true);
            }
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
                    if (data.derailed) {
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