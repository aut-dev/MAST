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
        this.interval = setInterval(() => this.pollProgress(), 30000);
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
            let progress = $('.task[data-id=' + data.taskId + '] .progress-bar');
            if (progress.length) {
                progress.css('width', data.percent + '%');
            }
        });
    }

    initTimerLinks()
    {
        $(document).on('click','.js-toggle-timer', e => {
            e.preventDefault();
            let taskId = $(e.currentTarget).data('task-id');
            if (!taskId) {
                return;
            }
            let restart = $(e.currentTarget).find('.fa-play').length > 0;
            if (this.started) {
                this.stopTimer().done(() => {
                    if (restart) {
                        this.startTimer(taskId);
                    }
                });
            } else {
                this.startTimer(taskId);
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
                let task = $('.task[data-id=' + data.taskId + ']');
                if (task.length) {
                    task.find('.complete').show();
                    task.find('.incomplete').hide();
                }
            }
        });
    }

    startTimer(taskId)
    {
        return $.ajax({
            url: '/?action=plugin-timer/timer/start',
            data: {
                taskId: taskId
            }
        }).done((data) => {
            this.started = true;
            this.updateCurrentTimer(data.current);
            this.startPolling();
            $('.js-toggle-timer[data-task-id=' + taskId + ']').find('i').removeClass('fa-play').addClass('fa-stop');
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