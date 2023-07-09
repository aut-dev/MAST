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
        this.updateProgressPoll();
        setInterval(() => this.pollTasks(), 10000);
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

    pollProgress()
    {
        console.log('poll');
        $.each($('.task.timer-started'), (i, task) => {
            let $task = $(task);
            let progress = parseFloat($task.data('progress'));
            if (progress > 100) {
                return;
            }
            let persec = parseFloat($task.data('persec'));
            progress = progress + persec;
            $task.data('progress', progress);
            $task.find('.progress-bar').css('width', progress + '%');
            if (progress > 100) {
                this.pollTasks();
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
        }).done(() => {
            let $task = this.getTask(taskId);
            $task.removeClass('timer-started');
            $task.find('.js-start-timer').html($task.find('.js-start-timer').data('textstart'));
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
            $task.find('.js-start-timer').html($task.find('.js-start-timer').data('textstop'));
            this.updateProgressPoll();
        });
    }

    pollTasks()
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