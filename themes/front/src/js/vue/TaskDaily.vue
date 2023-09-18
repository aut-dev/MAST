<template>
    <div :class="'daily-task position-relative' + (current ? ' current' : '') + ' status-' + status">
        <span class="inner-circle"></span>
        <span class="outer-circle"></span>
        <div class="progress">
            <span class="progress-left">
                <span class="progress-bar" :style="'transform: rotate(' + leftProgress + 'deg)'"></span>
            </span>
            <span class="progress-right">
                <span class="progress-bar" :style="'transform: rotate(' + rightProgress + 'deg)'"></span>
            </span>
        </div>
        <span class="inner" v-if="!current">
            <i v-if="status == 'complete'" class="fa-solid fa-check text-green"></i>
            <i v-if="status == 'derailed'" class="fa-solid fa-xmark text-red"></i>
            <span v-if="status == 'inactive' || future" class="day">{{ daily.day }}</span>
        </span>
        <span class="inner" v-if="current">
            <a href="#" @click.prevent="store.setTaskDone(task.id, !daily.complete, deadlineHasPassed)" v-if="!task.timeBased && status != 'inactive'">
                <i class="fa-solid fa-check"></i>
            </a>
            <span v-if="!task.timeBased && status == 'inactive'" class="day fs-3">{{ daily.day }}</span>
            <a href="#" @click.prevent="startTimer" v-if="task.timeBased && !timerStarted">
                <i class="fa-solid fa-play"></i>
            </a>
            <a href="#" @click.prevent="stopTimer" v-if="task.timeBased && timerStarted">
                <i class="fa-solid fa-stop"></i>
            </a>
        </span>
    </div>
</template>

<script>

import { useTasksStore } from './stores/TasksStore';
import axios from 'axios';

export default {
    props: {
        task: Object,
        daily: Object,
        current: Boolean,
        future: Boolean,
    },
    setup() {
        const store = useTasksStore();
        return { store };
    },
    data() {
        return {
            changingTimer: false,
            timerStarted: 0,
            progressInterval: null
        }
    },
    created() {
        if (this.current) {
            this.startPollingProgress(this.task.timerStarted);
        }
    },
    computed: {
        paused() {
            return this.task.paused || this.store.onUnlimitedBreak || this.store.onScheduledBreak;
        },
        status() {
            if (!this.daily.active || this.paused) {
                return 'inactive';
            }
            if (this.daily.complete) {
                return 'complete';
            }
            if (this.daily.derailed) {
                return 'derailed';
            }
            return 'active';
        },
        progress() {
            if (!this.daily.active || this.paused || this.future) {
                return 0;
            }
            if (!this.task.timeBased) {
                if (this.current) {
                    return this.daily.complete ? 100 : 0;
                }
                return 100;
            }
            return this.daily.progress;
        },
        leftProgress() {
            if (this.progress <= 50) {
                return 0;
            }
            let left = (this.progress - 50) / 100 * 360;
            return left > 180 ? 180 : left;
        },
        rightProgress() {
            if (this.progress <= 50) {
                return this.progress / 100 * 360;
            }
            return 180;
        },
        paused() {
            return this.task.paused || this.store.onUnlimitedBreak || this.store.onScheduledBreak;
        },
        deadlineHasPassed() {
            return this.getNow() > this.daily.deadline;
        },
    },
    methods: {
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
                this.daily.progress = data.data.progress;
                this.changingTimer = false;
            });
        },
        updateProgress() {
            this.daily.progress += this.task.progressPerSec;
            if (this.daily.progress > 101) {
                this.stopPollingProgress();
                this.store.fetchTask(this.task.id);
            }
        },
        startPollingProgress(started)
        {
            this.timerStarted = started;
            if (this.timerStarted && this.daily.progress < 100 && !this.deadlineHasPassed) {
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