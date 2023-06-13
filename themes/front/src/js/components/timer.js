/* global $ */

class Timer
{
    interval;

    constructor()
    {
        this.initTasksLinks();
        this.updatePoll();
        console.log('Timer initialised');
    }

    updatePoll()
    {
        let started = $.map($('.task.timer-started'), (task) => {
            return $(task).data('id');
        });
        if (started.length) {
            if (!this.interval) {
                this.interval = setInterval(() => this.pollProgress(), 10000);
            }
        } else {
            clearInterval(this.interval);
        }
    }

    initTasksLinks()
    {
        $(document).on('click','.task', e => {
            if ($(e.target).hasClass('click-through')) {
                return;
            }
            e.preventDefault();
            let taskId = $(e.currentTarget).data('id');
            if (!taskId) {
                return;
            }
            if ($(e.currentTarget).hasClass('timer-started')) {
                this.stopTimer(taskId);
            } else {
                this.startTimer(taskId);
            }
        });
    }

    pollProgress()
    {
        $.ajax({
            url: '/?action=plugin-timer/timer/poll-progress'
        }).done((data) => {
            let keys = Object.keys(data);
            keys.forEach((id) => {
                let progress = $('.task[data-id=' + id + '] .progress-bar');
                if (progress.length) {
                    progress.css('width', data[id].percent + '%');
                }
            });
        });
    }

    stopTimer(taskId)
    {
        return $.ajax({
            url: '/?action=plugin-timer/timer/stop',
            data: {
                taskId: taskId
            }
        }).done(() => {
            $('.task[data-id=' + taskId + ']').removeClass('timer-started');
            this.updatePoll();
        });
    }

    startTimer(taskId)
    {
        return $.ajax({
            url: '/?action=plugin-timer/timer/start',
            data: {
                taskId: taskId
            }
        }).done(() => {
            $('.task[data-id=' + taskId + ']').addClass('timer-started');
            this.updatePoll();
        });
    }
}

export { Timer };