/* global $ App */

class Timer
{
    $currentTimer;
    started;
    interval;

    constructor()
    {
        this.started = window.Globals.timerStarted;
        this.$currentTimer = $('#current-timer');
        this.initTimerLinks();
        if (this.started) {
            this.startPolling();
        }
        console.log('Timer initialised');
    }

    startPolling()
    {
        this.interval = setInterval(() => this.pollProgress(), 10000);
    }

    stopPolling()
    {
        clearInterval(this.interval);
    }

    pollProgress()
    {
        $.ajax({
            url: '/?action=plugin-timer/timer/poll-progress'
        }).done((data) => {
            let progress = $('.block[data-id=' + data.blockId + '] .progress-bar');
            if (progress.length) {
                progress.css('width', data.percent + '%');
            }
        });
    }

    initTimerLinks()
    {
        $(document).on('click','.js-toggle-timer', e => {
            e.preventDefault();
            let blockId = $(e.currentTarget).data('block-id');
            if (!blockId) {
                return;
            }
            let restart = $(e.currentTarget).hasClass('fa-play');
            if (this.started) {
                this.stopTimer().done(() => {
                    if (restart) {
                        this.startTimer(blockId);
                    }
                });
            } else {
                this.startTimer(blockId);
            }
        });
    }

    stopTimer()
    {
        return $.ajax({
            url: '/?action=plugin-timer/timer/stop',
        }).done((data) => {
            this.started = false;
            $('.js-toggle-timer i').removeClass('fa-stop').addClass('fa-play');
            this.$currentTimer.hide();
            this.stopPolling();
            if (data.complete) {
                let block = $('.block[data-id=' + data.blockId + ']');
                if (block.length) {
                    block.find('.complete').show();
                    block.find('.incomplete').hide();
                }
            }
        });
    }

    startTimer(blockId)
    {
        return $.ajax({
            url: '/?action=plugin-timer/timer/start',
            data: {
                blockId: blockId
            }
        }).done((data) => {
            this.started = true;
            this.updateCurrentTimer(data.current);
            this.startPolling();
            $('.js-toggle-timer[data-block-id=' + blockId + ']').find('i').removeClass('fa-play').addClass('fa-stop');
        }).fail((response) => {
            if (response.status == 400) {
                App.addToast(response.responseJSON.error, 'danger');
            } else {
                App.unexpectedError();
            }
        });
    }

    updateCurrentTimer(html)
    {
        this.$currentTimer.html(html).show();
    }
}

export { Timer };