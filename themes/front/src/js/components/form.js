/*global $*/

import "../../css/app/components/forms.scss";

class Form
{
    $form;

    constructor($form)
    {
        this.$form = $form;
        if (this.$form.find('.select2')) {
            this.initSelect2();
        }
        if (this.$form.find('.datepicker')) {
            this.initDatepicker();
        }
        this.initSubmit();
        this.$form.data('form', this);
    }

    initSubmit()
    {
        this.$form.submit(() => {
            this.onSubmit();
        });
    }

    initDatepicker()
    {
        import(/* webpackChunkName: "flatpickr" */ './flatpickr').then((chunk) => {
            chunk.flatpickr.l10ns.default.firstDayOfWeek = 1;
            $.each(this.$form.find(".datepicker"),(i, elem) => {
                chunk.flatpickr(elem, $(elem).data('options'));
            });
        });
    }

    initSelect2()
    {
        import(/* webpackChunkName: "select2" */ './select2').then(() => {
            $.each(this.$form.find(".select2"), (i, elem) => {
                $(elem).select2($(elem).data('options'));
            });
        });
    }

    onSubmit()
    {
        this.$form.find('.spinner-border').show();
        this.disableSubmit();
    }

    onSubmitEnd()
    {
        this.$form.find('.spinner-border').hide();
        this.enableSubmit();
    }

    reset()
    {
        this.$form.trigger('reset');
    }

    enableSubmit()
    {
        this.$form.find('[type=submit]').attr('disabled', false);
    }

    disableSubmit()
    {
        this.$form.find('[type=submit]').attr('disabled', true);
    }
}

export { Form };
