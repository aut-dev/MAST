/* global $ App Globals */

import 'jquery-ui/themes/base/core.css';
import 'jquery-ui/themes/base/theme.css';
import 'jquery-ui/ui/core';
import 'jquery-ui/ui/widgets/sortable';
import '../../css/app/components/tasks.scss';

class Tasks
{
    $modal;
    modal;
    interval;
    polling = false;
    $tasks;

    constructor () 
    {
        this.$tasks = $('.task');
        this.$modal = $('#delete-task-modal');
        App.getBootstrap().then((bootstrap) => {
            this.modal = new bootstrap.Modal(document.getElementById('delete-task-modal'));
            this.initModal();
        });
        this.initDeleteLinks();
        this.initSortable();
        this.initTasks();
        this.updateProgressPoll();
        setInterval(() => this.pollTasks(), 10000);
        console.log('Tasks initialised');
    }

    initTasks()
    {
        this.$tasks.click((e) => {
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

    initSortable()
    {
        $('#sortable').sortable({
            handle: ".handle",
            stop: this.updatePositions
        });
    }

    initDeleteLinks()
    {
        $('.js-delete-task').click(e => {
            this.$modal.find('.js-delete').data('id', $(e.currentTarget).data('id'));
        });
    }

    initModal()
    {
        this.$modal.find('.js-delete').click((e) => {
            this.deleteTask($(e.currentTarget).data('id'));
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
            $('.task[data-id=' + taskId + ']').removeClass('timer-started');
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
            $('.task[data-id=' + taskId + ']').addClass('timer-started');
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

    deleteTask(id)
    {
        if (id) {
            $.ajax({
                url: '/',
                method: 'post',
                data: {
                    action: 'entries/save-entry',
                    entryId: id,
                    enabled: 0
                },
                dataType: 'json',
                headers: {
                    "X-CSRF-Token": Globals.csrfToken
                }
            }).done(() => {
                this.getTask(id).parent().remove();
                this.modal.hide();
            });
        }
    }

    getTask(id)
    {
        return this.$tasks.filter('[data-id=' + id + ']');
    }
}

new Tasks;