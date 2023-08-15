<template>
    <div class="container">
        <div class="row" id="sortable">
            <div class="col-12 col-md-6 col-lg-4 col-xl-3 py-3" v-for="task, id in store.tasks">
                <task :task="task" :key="id"></task>
            </div>
        </div>
        <div class="d-flex justify-content-center" v-if="store.initialTaskLoading">
            <div class="spinner-border" style="width: 3rem; height: 3rem;" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
        <unlimited-break-modal/>
    </div>
</template>

<script>

import { mapState } from 'pinia';
import { useTasksStore } from './TasksStore';
import Task from './Task.vue';
import UnlimitedBreakModal from './UnlimitedBreakModal.vue';

export default {
    components: {
        Task,
        UnlimitedBreakModal,
    },
    setup() {
        const store = useTasksStore();
        return { store };
    },
    created() {
        this.store.fetchTasks();
        setInterval(() => this.store.fetchTasks(), 10000);
    }
};

</script>