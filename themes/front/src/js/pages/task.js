/* globals App $ */

import '../../css/app/components/task.scss';

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
        this.initPager(this.$timesheetList);
        console.log('Task initialised');
    }

    initDeleteLinks($elem)
    {
        $elem.find('.js-delete').click((e) => {
            let id = $(e.currentTarget).closest('.timesheet').data('id');
            this.$deleteModal.find('[name=elementId]').val(id);
            this.deleteModal.show();
        });
    }

    initEditModal()
    {
        let $form = this.$editModal.find('form');
        $form.submit(e => {
            e.preventDefault();
            $.ajax({
                url: '/',
                method: 'post',
                data: $form.serialize(),
                dataType: 'json'
            }).done(() => {
                this.reloadTimesheets();
                App.addToast('Time entry saved');
                this.editModal.hide();
                App.removeErrors($form);
            }).fail(response => {
                App.handleError(response, $form);
            }).always(() => {
                $form.find('.spinner-border').hide();
                $form.find('[type=submit]').attr('disabled', false);
            });
        });
    }

    initDeleteModal()
    {
        let $form = this.$deleteModal.find('form');
        $form.submit(e => {
            e.preventDefault();
            $.ajax({
                url: '/',
                method: 'post',
                data: $form.serialize(),
                dataType: 'json'
            }).done(() => {
                $('.timesheet[data-id=' + this.$deleteModal.find('[name=elementId]').val() + ']').remove();
                this.deleteModal.hide();
                App.addToast('Time entry deleted');
            }).fail(response => {
                App.handleError(response, $form);
            }).always(() => {
                $form.find('.spinner-border').hide();
                $form.find('[type=submit]').attr('disabled', false);
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

    initPager($elem)
    {
        $elem.find('.page-link').click((e) => {
            e.preventDefault();
            this.reloadTimesheets($(e.target).data('page'));
        });
    }

    reloadTimesheets(page = 1)
    {
        $.ajax({
            url: '/ajax/timesheets',
            data: {
                taskId: this.$timesheetList.data('id'),
                page: page
            }
        }).done((data) => {
            this.$timesheetList.html(data);
            this.initDeleteLinks(this.$timesheetList);
            this.initEditLinks(this.$timesheetList);
            this.initPager(this.$timesheetList);
        })
    }
}

new Task;