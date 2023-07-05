/* global $ Globals */

class App
{
    bootstrap;
    timer;

    constructor()
    {
        this.disableLogger();
        this.getBootstrap();
        this.initTooltips($('[data-bs-toggle="tooltip"]'));
        this.initToasts($('.toast'));
        this.initForms($('form'));
        this.initFontAwesome();
        this.initMatrixContent();
        this.initDetectTimezone();
        $('body').css('opacity', 1);
        console.log('App initialized');
    }

    initDetectTimezone()
    {
        let userTimezone = Globals.timezone;
        let refused = Globals.refusedTimezoneChange;
        if (!userTimezone || refused) {
            return;
        }
        let current = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (current != userTimezone) {
            $('#change-timezone-message .current').html(current);
            $('#change-timezone-message').fadeIn();
        }
        $('#change-timezone-message .js-no').click((e) => {
            e.preventDefault();
            $.ajax({
                url: '/?action=plugin-users/users/refused-timezone-change'
            });
            $('#change-timezone-message').fadeOut();
        });
        $('#change-timezone-message .js-yes').click((e) => {
            e.preventDefault();
            $.ajax({
                url: '/?action=plugin-users/users/change-timezone',
                data: {
                    timezone: current
                }
            }).done(() => {
                this.addToast('Your timezone has been changed to ' + current);
            });
            $('#change-timezone-message').fadeOut();
        });
    }

    initMatrixContent()
    {
        if ($('.matrix-block').length) {
            import(/* webpackChunkName: "timer" */ './components/matrixContent').then(chunk => {
                new chunk.MatrixContent;
            });
        }
    }

    getBootstrap()
    {
        if (!this.bootstrap) {
            this.bootstrap = import(/* webpackChunkName: "bootstrap" */ 'bootstrap');
        }
        return this.bootstrap;
    }

    disableLogger()
    {
        if (window.Globals.env == 'production') {
            console.log = function() {};
        }
    }

    initFontAwesome()
    {
        if ($('.fa-brands, .fa-solid, .fa-regular, .fa-light, .fa-thin, .fa-duotone').length) {
            import(/* webpackChunkName: "fontawesome" */ './components/fontawesome');
        }
    }

    initForms($forms)
    {
        if ($forms.length) {
            import(/* webpackChunkName: "form" */ './components/form').then(chunk => {
                $.each($forms, (i, elem) => {
                    new chunk.Form($(elem));
                });
            });
        }
    }

    initToasts($elems)
    {
        if ($elems.length) {
            this.getBootstrap().then((bootstrap) => {
                $.each($elems, function (i, elem) {
                    bootstrap.Toast.getOrCreateInstance(elem).show();
                });
            });
        }
    }

    initTooltips($elems)
    {
        if ($elems.length) {
            this.getBootstrap().then((bootstrap) => {
                $.each($elems, function (i, elem) {
                    new bootstrap.Tooltip(elem);
                });
            });
        }
    }

    addToast(message, type = "success", autoHide = true)
    {
        let _class = "align-items-center text-white border-0 toast bg-" + type;
        let toast = $('<div class="' + _class + '" role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="4000" data-bs-autohide="' + (autoHide ? 'true' : 'false') + '"><div class="d-flex"><div class="toast-body">' + message + '</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div></div>');
        toast.appendTo($('#global-messages'));
        this.initToasts(toast);
    }

    handleError(data, $elem, showToast = true)
    {
        if (data.status == 400) {
            let errors = {};
            if (data.responseJSON && data.responseJSON.errors) {
                errors = data.responseJSON.errors;
            }
            if (showToast) {
                this.addToast("Please fix the validation errors", "danger");
            }
            if ($elem) {
                this.showErrors($elem, errors);
            }
        } else {
            this.unexpectedError();
        }
    }

    showErrors($elem, errors)
    {
        let $item;
        this.removeErrors($elem);
        for (let [name, list] of Object.entries(errors)) {
            $item = $elem.find('.field-' + name);
            for (let error of list) {
                $item.append('<div class="invalid-feedback">' + error + '</div>');
            }
        }
    }

    removeErrors($elem)
    {
        $elem.find('.invalid-feedback').remove();
    }

    unexpectedError()
    {
        this.addToast("An unexpected error happened", "danger");
    }

}

export default App;