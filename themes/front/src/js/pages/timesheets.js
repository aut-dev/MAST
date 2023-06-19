/* globals App $ */

import dateFormat from "dateformat";

class TimeSheets
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
        this.initEditLinks();
        console.log('TimeSheets initialised');
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
            }).done((data) => {
                let sheet = $('.timesheet[data-id=' + data.id + "]");
                let date = new Date(data.model.startDate.date);
                sheet.find('.start-date').html(dateFormat(date, 'yyyy/mm/dd HH:MM:ss'));
                date = new Date(data.model.endDate.date);
                sheet.find('.end-date').html(dateFormat(date, 'yyyy/mm/dd HH:MM:ss'));
                this.modal.hide();
                App.addToast('Timesheet saved');
            }).fail(response => {
                App.handleError(response, this.$modal.find('form'));
            });
        });
    }

    initEditLinks()
    {
        $('.js-edit').click((e) => {
            e.preventDefault();
            let id = $(e.currentTarget).data('id');
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

new TimeSheets;