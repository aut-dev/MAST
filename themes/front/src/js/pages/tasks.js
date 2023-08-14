/* global $ Globals */

import 'jquery-ui/themes/base/core.css';
import 'jquery-ui/themes/base/theme.css';
import 'jquery-ui/ui/core';
import 'jquery-ui/ui/widgets/sortable';
import '../../css/app/components/tasks.scss';
import { Task } from '../components/task';
import { UnlimitedBreak } from '../components/unlimited-break';

class Tasks
{
    interval;
    refreshing = false;
    $tasks;
    tasks = {};

    constructor () 
    {
        this.$tasks = $('.task');
        this.initSortable();
        $.each(this.$tasks, (i, task) => {
            this.tasks[$(task).data('id')] = new Task(this, $(task));
        });
        setInterval(() => this.refreshTasks(), 10000);
        new UnlimitedBreak(this.refreshTasks.bind(this));
        this.initHideInactiveTasks();
        console.log('Tasks initialised');
    }

    initHideInactiveTasks()
    {
        $('.js-hide-inactive').click(e => {
            e.preventDefault();
            let isOn = $('.js-hide-inactive i').hasClass('text-body');
            $.ajax({
                method: 'post',
                dataType: 'json',
                data: {
                    action: 'plugin-users/users/change-hide-inactive-tasks',
                    hide: isOn ? 1 : 0
                },
                headers: {
                    "X-CSRF-Token": Globals.csrfToken
                }
            });
            if (isOn) {
                $('.js-hide-inactive i').removeClass('text-body');
                $('.task[data-status=inactive]').closest('.task-col').hide();
            } else {
                $('.js-hide-inactive i').addClass('text-body');
                $('.task[data-status=inactive]').closest('.task-col').show();
            }
        });
    }

    initSortable()
    {
        $('#sortable').sortable({
            handle: ".task-wrapper",
            stop: () => {
                this.updatePositions();
            }
        });
    }

    inactiveTasksAreHidden()
    {
        return !$('.js-hide-inactive i').hasClass('text-body');
    }

    refreshTasks()
    {
        if (this.refreshing) {
            return false;
        }
        this.refreshing = true;
        $.ajax({
            url: '/?action=plugin-tasks/tasks/poll',
        }).done((data) => {
            this.refreshing = false;
            for (let id in data) {
                this.tasks[id].refresh(data[id]);
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
}

new Tasks;