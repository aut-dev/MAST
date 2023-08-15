import { defineStore } from 'pinia';
import axios from 'axios';

export const useTasksStore = defineStore('tasks', {
    state: () => ({
        onUnlimitedBreak: false,
        initialTaskLoading: true,
        loadingTasks: false,
        csrfToken: null,
        tasks: {}
    }),
    actions: {
        fetchTasks(id = null) {
            if (this.loadingTasks) {
                return;
            }
            this.loadingTasks = true;
            let url = '/?action=plugin-tasks/tasks/get';
            if (id) {
                url += '&id=' + id;
            }
            axios.get(url).then(data => {
                if (id) {
                    this.tasks[id] = data.data[id];
                } else {
                    this.tasks = data.data;
                }
                this.initialTaskLoading = false;
                this.loadingTasks = false;
            });
        },
        setUnlimitedBreak(value) {
            this.onUnlimitedBreak = value;
            return axios.post('/?action=plugin-users/breaks/unlimited-break', {
                unlimitedBreak: value
            }, {
                headers: {"X-CSRF-Token": this.csrfToken}
            });
        },
        updateTask(id, data) {
            this.tasks[id] = data;
        }
    }
});