/* global $ Globals */

import 'jquery-ui/themes/base/core.css';
import 'jquery-ui/themes/base/theme.css';
import 'jquery-ui/ui/core';
import 'jquery-ui/ui/widgets/sortable';
import '../../css/app/components/tasks.scss';
import { Task } from '../components/task';

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
        setInterval(() => this.pollProgress(), 1000);
        console.log('Tasks initialised');
    }

    initSortable()
    {
        $('#sortable').sortable({
            handle: ".task-wrapper",
            stop: this.updatePositions
        });
    }

    pollProgress()
    {
        for (let id in this.tasks) {
            this.tasks[id].updateProgress();
        }
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