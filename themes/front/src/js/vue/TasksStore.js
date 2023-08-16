/* globals Craft */

import { defineStore } from 'pinia';
import axios from 'axios';
import { findIndex } from 'lodash';

export const useTasksStore = defineStore('tasks', {
    state: () => ({
        onUnlimitedBreak: false,
        initialTaskLoading: true,
        disableFetchingTasks: false,
        hideInactiveTasks: false,
        doning: false,
        reordering: false,
        tasks: []
    }),
    actions: {
        fetchTasks() {
            if (this.disableFetchingTasks) {
                return;
            }
            this.disableFetchingTasks = true;
            axios.get('/?action=plugin-tasks/tasks/get').then(data => {
                this.tasks = data.data;
                this.initialTaskLoading = false;
                this.disableFetchingTasks = false;
            });
        },
        fetchTask(id) {
            this.disableFetchingTasks = true;
            axios.get('/?action=plugin-tasks/tasks/get&id=' + id).then(data => {
                let index = findIndex(this.tasks, (task) => {
                    return task.id == id;
                });
                this.tasks[index] = data.data[0];
                this.disableFetchingTasks = false;
            });
        },
        setUnlimitedBreak(value) {
            this.disableFetchingTasks = true;
            this.onUnlimitedBreak = value;
            axios.post('/?action=plugin-users/breaks/unlimited-break', {
                unlimitedBreak: value
            }, {
                headers: {"X-CSRF-Token": Craft.csrfToken}
            }).then(() => {
                this.disableFetchingTasks = false;
            });
        },
        setHideInactiveTasks(value) {
            this.hideInactiveTasks = value;
            axios.post('/?action=plugin-users/users/set-hide-inactive-tasks', {
                hideInactiveTasks: value
            }, {
                headers: {"X-CSRF-Token": Craft.csrfToken}
            });
        },
        setTaskDone(id, done)
        {
            if (this.doning) {
                return;
            }
            this.doning = true;
            this.disableFetchingTasks = true;
            let index = findIndex(this.tasks, (task) => {
                return task.id == id;
            });
            let task = this.tasks[index];
            task.done = done;
            axios.post('/?action=plugin-tasks/tasks/done', {
                id: id,
                done: done
            }, {
                headers: {"X-CSRF-Token": Craft.csrfToken}
            }).then((data) => {
                this.tasks[index] = data.data;
                this.doning = false;
                this.disableFetchingTasks = false;
            });
        },
        reorder() {
            if (this.reordering) {
                return;
            }
            this.reordering = true;
            this.disableFetchingTasks = true;
            let data = [];
            for (let i in this.tasks) {
                data.push({
                    order: i,
                    id: this.tasks[i].id
                });
            }
            axios.post('/?action=plugin-tasks/tasks/reorder', {data: data}, {
                headers: {"X-CSRF-Token": Craft.csrfToken}
            }).then(() => {
                this.reordering = false;
                this.disableFetchingTasks = false;
            });
        }
    }
});