/* global $ Globals */

import 'jquery-ui/themes/base/core.css';
import 'jquery-ui/themes/base/theme.css';
import 'jquery-ui/ui/core';
import 'jquery-ui/ui/widgets/sortable';
import '../../css/app/components/tasks.scss';

class Tasks
{
    interval;
    polling = false;
    $tasks;

    constructor () 
    {
        this.$tasks = $('.task');
        this.initSortable();
        this.initTasks();
        $.each(this.$tasks.filter('.timer-started'), function (i, task) {
            $(task).data('timer-started', new Date().getTime() / 1000);
        });
        this.updateProgressPoll();
        setInterval(() => this.refreshTasks(), 10000);
        console.log('Tasks initialised');
    }

    initTasks()
    {
        this.$tasks.find('.js-start-timer').click((e) => {
            e.preventDefault();
            let $task = $(e.target).closest('.task');
            let taskId = $task.data('id');
            if (!taskId) {
                return;
            }
            if ($task.hasClass('timer-started')) {
                this.stopTimer(taskId);
            } else {
                this.startTimer(taskId);
            }
        });
    }

    initSortable()
    {
        $('#sortable').sortable({
            handle: ".task-wrapper",
            stop: this.updatePositions
        });
    }

    updateProgressPoll()
    {
        let started = $.map($('.task.polling'), (task) => {
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

    pollProgress()
    {
        $.each($('.task.polling'), (i, task) => {
            let $task = $(task);
            let progress = parseFloat($task.data('progress'));
            let started = parseInt($task.data('timer-started'));
            let elapsed = (new Date().getTime() / 1000) - started;
            let persec = parseFloat($task.data('persec'));
            progress = progress + (persec * elapsed);
            $task.find('.progress-bar').css('width', progress + '%');
            if (progress > 100) {
                $task.removeClass('polling');
                this.updateProgressPoll();
                this.refreshTasks();
            }
        });
    }

    stopTimer(taskId)
    {
        return $.ajax({
            url: '/?action=plugin-timer/timer/stop',
            data: {
                taskId: taskId
            }
        }).done((data) => {
            let $task = this.getTask(taskId);
            $task.removeClass(['polling', 'timer-started']);
            $task.find('.js-start-timer').html($task.find('.js-start-timer').data('textstart'));
            $task.data('timer-started', 0);
            $task.data('progress', data.progress);
            $task.find('.progress-bar').css('width', data.progress + '%');
            this.updateProgressPoll();
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
            let $task = this.getTask(taskId);
            $task.addClass('timer-started');
            let progress = parseFloat($task.data('progress'));
            if (progress < 100) {
                $task.data('timer-started', new Date().getTime() / 1000);
                $task.addClass('polling');
            }
            $task.find('.js-start-timer').html($task.find('.js-start-timer').data('textstop'));
            this.updateProgressPoll();
        });
    }

    refreshTasks()
    {
        if (this.polling) {
            return false;
        }
        this.polling = true;
        $.ajax({
            url: '/?action=plugin-tasks/tasks/poll',
        }).done((data) => {
            this.polling = false;
            for (let id in data) {
                let $task = this.getTask(id);
                $task.attr('data-status', data[id].status);
                $task.find('.inner').html(data[id].inner);
                $task.find('.complete-tick').hide();
                if (data[id].status == 'complete') {
                    $task.find('.complete-tick').show();
                }
            }
        });
    }

    updatePositions()
    {
        let data = [];
        $.each($('.task'), (i, item) => {
            data.push({
                id: $(item).data('id'),
                order: i
            });
        });
        $.ajax({
            method: 'post',
            url: '/?action=plugin-tasks/tasks/reorder',
            data: {
                data: data
            },
            headers: {
                "X-CSRF-Token": Globals.csrfToken
            }
        });
    }

    getTask(id)
    {
        return this.$tasks.filter('[data-id=' + id + ']');
    }
}

new Tasks;