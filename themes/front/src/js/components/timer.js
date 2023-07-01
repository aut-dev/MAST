/* global $ */

class Timer
{
    interval;
    taskRefreshed = [];

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
                this.interval = setInterval(() => this.pollProgress(), 1000);
            }
        } else {
            clearInterval(this.interval);
            this.interval = null;
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
        $.each($('.task.timer-started'), (i, task) => {
            let $task = $(task);
            let persec = parseFloat($task.data('persec'));
            let progress = parseFloat($task.data('progress'));
            let id = $task.data('id');
            progress = progress + persec;
            $task.data('progress', progress);
            $task.find('.progress-bar').css('width', progress + '%');
            if (progress > 101 && !this.taskRefreshed.includes(id)) {
                this.refreshTask(id);
            }
        });
    }

    refreshTask(taskId)
    {
        this.taskRefreshed.push(taskId);
        $.ajax({
            url: '/?action=plugin-tasks/tasks/status',
            data: {
                id: taskId
            }
        }).done((data) => {
            let $task = $('.task[data-id=' + taskId + ']');
            $task.removeClass(['border-task-active', 'border-task-complete', 'border-task-expired']).addClass('border-task-' + data.status);
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