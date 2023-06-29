/* globals App $ */

class Task
{
    $modal;
    modal;

    constructor () 
    {
        this.$modal = $('#edit-timesheet-modal');
        App.getBootstrap().then((bootstrap) => {
            this.modal = new bootstrap.Modal(document.getElementById('edit-timesheet-modal'));
            this.initModal();
        });
        this.initEditLinks($('body'));
        this.initAddLink();
        console.log('Task initialised');
    }

    initModal()
    {
        this.$modal.find('.js-save').click(() => {
            this.$modal.find('form').submit();
        });
        this.$modal.find('form').submit(e => {
            e.preventDefault()
            $.ajax({
                url: '/',
                method: 'post',
                data: this.$modal.find('form').serialize(),
                dataType: 'json'
            }).done(() => {
                window.location.reload();
            }).fail(response => {
                App.handleError(response, this.$modal.find('form'));
            });
        });
    }

    initAddLink()
    {
        $('.js-add').click((e) => {
            e.preventDefault();
            let $title = this.$modal.find('h5.modal-title');
            this.$modal.find('[name=entryId]').val('');
            $title.html($title.data('add-title'));
            this.$modal.find('#startDate')[0]._flatpickr.setDate(null);
            this.$modal.find('#endDate')[0]._flatpickr.setDate(null);
            this.modal.show();
        });
    }

    initEditLinks($elem)
    {
        $elem.find('.js-edit').click((e) => {
            e.preventDefault();
            let id = $(e.currentTarget).closest('.timesheet').data('id');
            let $title = this.$modal.find('h5.modal-title');
            $title.html($title.data('edit-title'));
            $.ajax({
                url: '/?action=plugin-timesheets/timesheets/get&id=' + id
            }).done(data => {
                this.$modal.find('[name=entryId]').val(id);
                this.$modal.find('#startDate')[0]._flatpickr.setDate(data.start);
                this.$modal.find('#endDate')[0]._flatpickr.setDate(data.end);
                this.modal.show();
            });
        });
    }
}

new Task;