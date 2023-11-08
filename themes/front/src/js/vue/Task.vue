<template>
    <div class="col-12 col-md-6 col-xl-4 mb-3 task" v-if="!store.hideInactiveTasks || !inactive">
        <div class="border-bottom border-light pb-3 position-relative">
            <div class="d-flex justify-content-between mb-2 align-items-start pe-4">
                <div class="text-truncate">
                    <h4 class="m-0 text-truncate">{{ task.title }}</h4>
                    <div v-if="task.timeBased">{{ capitalize(task.taskType) }} than {{ task.length }}min</div>
                    <div v-if="!task.timeBased">Done</div>
                    <div>or ${{ task.committed }}</div>
                </div>
            </div>
            <div class="buttons">
                <span class="me-2" v-if="paused"><b>Paused</b></span>
                <div class="btn-group" role="group">
                    <span class="dropdown-link" data-bs-toggle="dropdown" aria-expanded="false">
                        ...
                    </span>
                    <ul class="dropdown-menu">
                        <li><a class="dropdown-item" :href="'/edit-task?id=' + task.id">Edit</a></li>
                        <li><a class="dropdown-item" :href="task.url">View</a></li>
                        <li><a class="dropdown-item" href="#" @click.prevent="store.setTaskPaused(task.id, !task.paused)">{{ task.paused ? 'Unpause' : 'Pause' }}</a></li>
                    </ul>
                </div>
            </div>
            <div class="d-flex justify-content-between align-items-center">
                <task-daily v-for="daily, index in task.past" :key="index" :task="task" :daily="daily" :current="false" :future="false" />
                <task-daily :task="task" :daily="task.daily" :current="true" :future="false"/>
                <task-daily v-for="daily, index in task.future" :key="index" :task="task" :daily="daily" :current="false" :future="true" />
            </div>
            <span class="pause-overlay" v-if="paused"></span>
        </div>
    </div>
</template>

<script>

import { useTasksStore } from './stores/TasksStore';
import TaskDaily from './TaskDaily.vue';
import { capitalize } from 'lodash';
import axios from 'axios';

export default {
    components: {
        TaskDaily
    },
    setup() {
        const store = useTasksStore();
        return { store };
    },
    props: {
        task: Object
    },
    computed: {
        paused() {
            return this.task.paused || this.store.onUnlimitedBreak || this.store.onScheduledBreak;
        },
        inactive() {
            if (!this.task.daily.active) {
                return true;
            }
            return false;
        }
    },
    methods: {
        capitalize(str) {
            return capitalize(str);
        },
    }
};

</script>