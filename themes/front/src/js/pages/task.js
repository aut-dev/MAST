/* globals App $ */

class Task
{
    $editModal;
    editModal;
    $deleteModal;
    deleteModal;
    $timesheetList;

    constructor () 
    {
        this.$editModal = $('#edit-timesheet-modal');
        this.$deleteModal = $('#delete-timesheet-modal');
        this.$timesheetList = $('#timesheet-list');
        App.getBootstrap().then((bootstrap) => {
            this.editModal = new bootstrap.Modal(document.getElementById('edit-timesheet-modal'));
            this.deleteModal = new bootstrap.Modal(document.getElementById('delete-timesheet-modal'));
            this.initEditModal();
            this.initDeleteModal();
        });
        this.initAddLink();
        this.initEditLinks(this.$timesheetList);
        this.initDeleteLinks(this.$timesheetList);
        console.log('Task initialised');
    }

    initDeleteLinks($elem)
    {
        $elem.find('.js-delete').click((e) => {
            let id = $(e.currentTarget).data('id');
            this.$deleteModal.find('[name=elementId]').val(id);
            this.deleteModal.show();
        });
    }

    initEditModal()
    {
        this.$editModal.find('.js-save').click(() => {
            this.$editModal.find('form').submit();
        });
        this.$editModal.find('form').submit(e => {
            e.preventDefault()
            $.ajax({
                url: '/',
                method: 'post',
                data: this.$editModal.find('form').serialize(),
                dataType: 'json'
            }).done(() => {
                this.reloadTimesheets();
                App.addToast('Time entry saved');
                this.editModal.hide();
            }).fail(response => {
                App.handleError(response, this.$editModal.find('form'));
            });
        });
    }

    initDeleteModal()
    {
        this.$deleteModal.find('form').submit(e => {
            e.preventDefault()
            $.ajax({
                url: '/',
                method: 'post',
                data: this.$deleteModal.find('form').serialize(),
                dataType: 'json'
            }).done(() => {
                $('.timesheet[data-id=' + this.$deleteModal.find('[name=elementId]').val() + ']').remove();
                this.deleteModal.hide();
                App.addToast('Time entry deleted');
            }).fail(response => {
                App.handleError(response, this.$deleteModal.find('form'));
            });
        });
    }

    initAddLink()
    {
        $('.js-add').click((e) => {
            e.preventDefault();
            let $title = this.$editModal.find('h5.modal-title');
            this.$editModal.find('[name=entryId]').val('');
            $title.html($title.data('add-title'));
            this.$editModal.find('#startDate')[0]._flatpickr.setDate(null);
            this.$editModal.find('#endDate')[0]._flatpickr.setDate(null);
            this.editModal.show();
        });
    }

    initEditLinks($elem)
    {
        $elem.find('.js-edit').click((e) => {
            e.preventDefault();
            let id = $(e.currentTarget).closest('.timesheet').data('id');
            let $title = this.$editModal.find('h5.modal-title');
            $title.html($title.data('edit-title'));
            $.ajax({
                url: '/?action=plugin-timesheets/timesheets/get&id=' + id
            }).done(data => {
                this.$editModal.find('[name=entryId]').val(id);
                this.$editModal.find('#startDate')[0]._flatpickr.setDate(data.start);
                this.$editModal.find('#endDate')[0]._flatpickr.setDate(data.end);
                this.editModal.show();
            });
        });
    }

    reloadTimesheets()
    {
        $.ajax({
            url: '/ajax/timesheets',
            data: {
                taskId: this.$timesheetList.data('id')
            }
        }).done((data) => {
            this.$timesheetList.html(data);
            this.initDeleteLinks(this.$timesheetList);
            this.initEditLinks(this.$timesheetList);
        })
    }
}

new Task;