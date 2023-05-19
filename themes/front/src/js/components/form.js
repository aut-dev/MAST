/*global $*/

import "../../css/app/components/forms.scss";

class Form
{
    id;
    $form;
    $messages;

    constructor($form)
    {
        this.id = $form.attr('id');
        this.$form = $form;
        if (this.$form.hasClass('has-spinner')) {
            this.initSpinner();
        }
        if (this.$form.find('.select2')) {
            this.initSelect2();
        }
        if (this.$form.find('.datepicker')) {
            this.initDatepicker();
        }
        if (this.$form.hasClass('js-validate')) {
            this.initFormSubmit();
            console.log('Form ' + this.id + ' will be submitted by ajax');
            this.$messages = $('#' + this.id + '-messages');
            if (!this.$messages.length) {
                console.warn("The messages element (#" + this.id + "-messages) for the form " + this.id + " doesn't exist, messages won't be shown");
            }
        }
    }

    initSpinner()
    {
        this.$form.submit(() => {
            this.$form.find('.spinner-border').show();
        });
    }

    initDatepicker()
    {
        import(/* webpackChunkName: "flatpickr" */ './flatpickr').then((chunk) => {
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

    initFormSubmit()
    {
        document.getElementById(this.id).addEventListener('submit', (e) => {
            e.preventDefault();
        });
        document.getElementById(this.id).addEventListener('formidable.validation.success', (e) => {
            this.hideSuccess();
            this.removeErrors();
            this.disableSubmit()
            let url = e.target.action;
            let formData = new FormData(e.target);
            $.ajax({
                url: url,
                data: formData,
                contentType: false,
                processData: false,
                method: 'POST',
                dataType: 'JSON'
            }).done((data) => {
                if (data.success) {
                    this.showSuccess();
                    this.reset();
                }
            }).fail((response) => {
                if (response.responseJSON.errors) {
                    this.addErrors(response.responseJSON.errors);
                    this.scrollToMessages();
                }
            }).always(() => {
                this.reloadCaptcha();
                this.enableSubmit();
            });
        });
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

    reloadCaptcha()
    {
        window.googleV3Captcha.getCaptcha(this.id).then((token) => {
            this.$form.find('[name=_recaptcha_response]').val(token);
        });
    }

    removeErrors()
    {
        if (this.$messages.length) {
            this.$messages.find('.alert-danger').remove();
        }
    }

    addErrors(errors)
    {
        if (this.$messages.length) {
            for (let i in errors) {
                let list = errors[i];
                for (let j in list) {
                    $('<div class="alert alert-danger">'+list[j]+'</div>').appendTo(this.$messages);
                }
            }
        }
    }

    scrollToMessages()
    {
        if (this.$messages.length) {
            $('html, body').animate({ scrollTop: this.$messages.offset().top - 170 }, 500);
        }
    }

    hideSuccess()
    {
        if (this.$messages.length) {
            this.$messages.find('.alert-success').hide();
        }
    }

    showSuccess()
    {
        if (this.$messages.length) {
            let success = this.$messages.find('.alert-success');
            if (success.length) {
                success.fadeIn();
                $('html, body').animate({ scrollTop: success.offset().top - 170 }, 500);
            }
        }
    }
}

export { Form };
