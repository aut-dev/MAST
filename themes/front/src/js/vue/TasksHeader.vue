<template>
    <div class="container">
        <div class="alert alert-warning" role="alert" v-if="store.onUnlimitedBreak">
            {{ t("All your tasks are paused as you're on a unlimited break") }}
        </div>
        <div class="alert alert-warning" role="alert" v-if="onScheduledBreak && !store.onUnlimitedBreak">
            {{ t("All your tasks are paused as you're on a scheduled break today") }}
        </div>
        <div class="d-flex justify-content-between align-items-center">
            <h1>Tasks</h1>
            <div>
                <a href="#unlimited-break-modal" data-bs-toggle="modal" :class="{'me-2': true, 'text-body': !store.onUnlimitedBreak}" :title="t('Unlimited break')">
                    <i class="fa-solid fa-pause fs-3"></i>
                </a>
                <a href="#" :class="{'me-2': true, 'text-body': !store.hideInactiveTasks}" :title="t('Hide inactive tasks')" @click.prevent="store.setHideInactiveTasks(!store.hideInactiveTasks)">
                    <i class="fa-solid fa-eye-slash fs-4"></i>
                </a>
                <a href="/tasks/new" :title="t('Create a new task')" class="text-body">
                    <i class="fa-solid fa-plus fs-3"></i>
                </a>
            </div>
        </div>
    </div>
</template>

<script>

import { useTasksStore } from './TasksStore';
import axios from 'axios';

export default {
    setup() {
        const store = useTasksStore();
        return { store };
    },
    props: {
        onUnlimitedBreak: Boolean,
        onScheduledBreak: Boolean,
        hideInactiveTasks: Boolean
    },
    created() {
        this.store.onUnlimitedBreak = this.onUnlimitedBreak;
        this.store.hideInactiveTasks = this.hideInactiveTasks;
    },
};

</script>