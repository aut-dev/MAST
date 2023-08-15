<template>
    <div class="container">
        <div class="alert alert-warning" role="alert" v-if="store.onUnlimitedBreak">
            All your tasks are paused as you're on a unlimited break
        </div>
        <div class="alert alert-warning" role="alert" v-if="onScheduledBreak && !store.onUnlimitedBreak">
            All your tasks are paused as you're on a scheduled break today
        </div>
        <div class="d-flex justify-content-between align-items-center">
            <h1>Tasks</h1>
            <div>
                <a href="#unlimited-break-modal" data-bs-toggle="modal" :class="{'me-2': true, 'text-body': !store.onUnlimitedBreak}" title="Unlimited break">
                    <i class="fa-solid fa-pause fs-3"></i>
                </a>
                <a href="/tasks/new" title="Create a new task" class="text-body">
                    <i class="fa-solid fa-plus fs-3"></i>
                </a>
            </div>
        </div>
    </div>
</template>

<script>

import { useTasksStore } from './TasksStore';

export default {
    setup() {
        const store = useTasksStore();
        return { store };
    },
    props: {
        onUnlimitedBreak: Boolean,
        onScheduledBreak: Boolean,
        csrfToken: String
    },
    created() {
        this.store.onUnlimitedBreak = this.onUnlimitedBreak;
        this.store.csrfToken = this.csrfToken;
    }
};

</script>