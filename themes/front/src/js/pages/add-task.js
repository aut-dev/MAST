/* global $ App */

class AddTask
{
    $form;

    constructor () 
    {
        this.$form = $('#add-task-form');
        this.initSubmit();
        this.initWeeks();
        console.log('Add task initialised');
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
        });
    }
}

new AddTask;