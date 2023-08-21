<template>
    <div class="col-12 col-md-6 col-lg-4 col-xl-3 py-3" v-if="!store.hideInactiveTasks || status != 'inactive'">
        <a :href="task.url" class="text-body">
            <div :class="classes" style="background-color: {{ task.backgroundColor ?: #ffffff }}">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h4 class="m-0 text-truncate">{{ task.title }}</h4>
                    <div class="d-flex align-items-center">
                        <small v-if="status == 'paused'">
                            {{ t('Paused') }}
                        </small>
                        <span class="complete-tick ms-3" v-if="status == 'complete'">
                            <i class="fa-solid fa-check"></i>
                        </span>
                    </div>
                </div>
                <p class="text-light mb-0">
                    <span v-if="task.timeBased">
                        {{ capitalize(task.taskType) }} than {{ task.length }} min
                    </span>
                    <span v-if="!task.timeBased">
                        {{ t('One off') }}
                    </span>
                </p>
                <div v-if="showProgressBar">
                    <div class="progress">
                        <div :class="progressBarClasses" role="progressbar" :style="'width:' + task.progress + '%'" :aria-valuenow="task.progress" aria-valuemin="0" aria-valuemax="100"></div>
                    </div>
                </div>
                <p class="m-0" v-if="showCountdown">
                    {{ t('Minutes until deadline:') }} <span class="countdown">{{ task.countdown }}</span>
                </p>
                <div class="actions d-flex justify-content-between align-items-center mt-2">
                    <span class="text-purple2 fs-5" v-if="task.timeBased">
                        <span v-if="timerStarted" @click.prevent="stopTimer">{{ t('Stop') }}</span>
                        <span v-if="!timerStarted" @click.prevent="startTimer">{{ t('Start') }}</span>
                    </span>
                    <span :class="'text-purple2 fs-5 task-done' + (task.complete ? ' done' : '')" v-if="task.active && !task.timeBased" @click.prevent="store.setTaskDone(task.id, !task.complete, deadlineHasPassed)">
                        {{ t('Done') }}
                    </span>
                    <span class="fs-4" v-if="task.active">
                        ${{ task.committed }}
                    </span>
                </div>
            </div>
        </a>
    </div>
</template>

<script>

import { useTasksStore } from './stores/TasksStore';
import { capitalize } from 'lodash';
import axios from 'axios';

export default {
    setup() {
        const store = useTasksStore();
        return { store };
    },
    props: {
        task: Object
    },
    data() {
        return {
            changingTimer: false,
            timerStarted: 0,
            progressInterval: null
        }
    },
    computed: {
        status() {
            if (!this.task.active) {
                return 'inactive';
            }
            if (this.isPaused) {
                return 'paused';
            }
            if (this.task.complete) {
                return 'complete';
            }
            if (this.task.derailed) {
                return 'derailed';
            }
            return 'active';
        },
        classes() {
            let classes = 'square task p-3 bg-task rounded border-status-' + this.status;
            if (this.timerStarted) {
                classes += ' timer-started';
            }
            return classes;
        },
        showProgressBar() {
            if (!this.task.timeBased || this.isPaused || !this.task.active) {
                return false;
            }
            return true;
        },
        showCountdown() {
            if (this.isPaused) {
                return false;
            }
            if (!this.task.timeBased) {
                return !this.task.complete && this.task.countdown > 0;
            }
            if (this.deadlineHasPassed) {
                return false;
            }
            if (this.task.taskType == 'less') {
                return this.task.complete;
            }
            return this.task.active && !this.task.derailed && !this.task.complete;
        },
        deadlineHasPassed() {
            return this.getNow() > this.task.deadline;
        },
        isPaused() {
            return this.task.paused || this.store.onUnlimitedBreak || this.store.onScheduledBreak;
        },
        progressBarClasses() {
            let classes = 'progress-bar';
            if (this.deadlineHasPassed) {
                classes += ' bg-light';
            }
            if (this.task.taskType == 'less' && this.task.derailed) {
                classes += ' bg-light';
            }
            return classes;
        }
    },
    created() {
        this.startPollingProgress(this.task.timerStarted);
    },
    methods: {
        capitalize(str) {
            return capitalize(str);
        },
        startTimer() {
            if (this.changingTimer) {
                return;
            }
            this.changingTimer = true;
            this.startPollingProgress(this.getNow());
            axios.get('/?action=plugin-timer/timer/start&taskId=' + this.task.id + '&started=' + this.timerStarted).then((data) => {
                this.changingTimer = false;
            });
        },
        stopTimer() {
            if (this.changingTimer) {
                return;
            }
            this.changingTimer = true;
            this.stopPollingProgress();
            this.timerStarted = 0;
            axios.get('/?action=plugin-timer/timer/stop&taskId=' + this.task.id + '&stopped=' + this.getNow()).then((data) => {
                this.task.progress = data.data.progress;
                this.changingTimer = false;
            });
        },
        updateProgress() {
            this.task.progress += this.task.progressPerSec;
            if (this.task.progress > 101) {
                this.stopPollingProgress();
                this.store.fetchTask(this.task.id);
            }
        },
        startPollingProgress(started)
        {
            this.timerStarted = started;
            if (this.timerStarted && this.task.progress < 100 && !this.deadlineHasPassed) {
                this.progressInterval = setInterval(() => this.updateProgress(), 1000);
            }
        },
        stopPollingProgress()
        {
            clearInterval(this.progressInterval);
        },
        getNow() {
            return (new Date().getTime() / 1000);
        }
    }
};

</script>