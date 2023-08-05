/* globals App $ */

class Breaks
{
    $editModal;
    editModal;
    $deleteModal;
    deleteModal;
    $breakList;
    $filters;

    constructor () 
    {
        this.$editModal = $('#edit-break-modal');
        this.$deleteModal = $('#delete-break-modal');
        this.$breakList = $('#break-list');
        this.$filters = $('#break-filters');
        App.getBootstrap().then((bootstrap) => {
            this.deleteModal = new bootstrap.Modal(document.getElementById('delete-break-modal'));
            this.initDeleteModal();
            this.editModal = new bootstrap.Modal(document.getElementById('edit-break-modal'));
            this.initEditModal();
        });
        this.initAddLink();
        this.initFilters();
        this.initEditLinks(this.$breakList);
        this.initDeleteLinks(this.$breakList);
        console.log('Breaks initialised');
    }

    initFilters()
    {
        this.$filters.find('input').change(() => {
            this.reloadBreaks();
        });
    }

    initDeleteLinks($elem)
    {
        $elem.find('.js-delete').click((e) => {
            let id = $(e.currentTarget).closest('.break').data('id');
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
                this.reloadBreaks();
                App.addToast('Break saved');
                this.editModal.hide();
                App.removeErrors($form);
            }).fail(response => {
                App.handleError(response, $form);
            }).always(() => {
                this.$editModal.find('.spinner-border').hide();
                this.$editModal.find('[type=submit]').attr('disabled', false);
            });
        });
    }

    initAddLink()
    {
        $('.js-add-break').click((e) => {
            e.preventDefault();
            App.removeErrors(this.$editModal);
            let $title = this.$editModal.find('h5.modal-title');
            this.$editModal.find('[name=entryId]').val('');
            $title.html($title.data('add-title'));
            this.$editModal.find('#startDate')[0]._flatpickr.setDate(null);
            this.$editModal.find('#endDate')[0]._flatpickr.setDate(null);
            this.$editModal.find('#field-title').val('');
            this.editModal.show();
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
                this.reloadBreaks();
                this.deleteModal.hide();
                App.addToast('Break deleted');
            }).fail(response => {
                App.handleError(response, $form);
            }).always(() => {
                $form.find('.spinner-border').hide();
                $form.find('[type=submit]').attr('disabled', false);
            });
        });
    }

    initEditLinks($elem)
    {
        $elem.find('.js-edit').click((e) => {
            e.preventDefault();
            let id = $(e.currentTarget).closest('.break').data('id');
            let $title = this.$editModal.find('h5.modal-title');
            $title.html($title.data('edit-title'));
            App.removeErrors(this.$editModal);
            $.ajax({
                url: '/?action=plugin-users/breaks/get&id=' + id
            }).done(data => {
                this.$editModal.find('[name=entryId]').val(id);
                this.$editModal.find('#startDate')[0]._flatpickr.setDate(data.start);
                this.$editModal.find('#endDate')[0]._flatpickr.setDate(data.end);
                this.$editModal.find('#field-title').val(data.title);
                this.editModal.show();
            });
        });
    }

    reloadBreaks()
    {
        $.ajax({
            url: '/ajax/breaks',
            data: {
                showPast: this.$filters.find('#showPast').is(':checked') ? 1 : 0
            }
        }).done((data) => {
            this.$breakList.html(data);
            this.initDeleteLinks(this.$breakList);
            this.initEditLinks(this.$breakList);
        });
    }
}

new Breaks;