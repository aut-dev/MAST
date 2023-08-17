<template>
    <div class="container">
        <draggable v-model="store.tasks" tag="div" class="row" :animation="300" item-key="id" :disabled="store.reordering" @start="startDrag" @end="endDrag" >
            <template #item="{ element: task }">
                <task :task="task"/>
            </template>
        </draggable>
        <div class="d-flex justify-content-center" v-if="store.initialTaskLoading">
            <div class="spinner-border" style="width: 3rem; height: 3rem;" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
        <div v-if="store.tasks.length == 0 && !store.initialTaskLoading">
            {{ t('You have no tasks yet') }}
        </div>
        <unlimited-break-modal/>
    </div>
</template>

<script>

import { mapState } from 'pinia';
import { useTasksStore } from './stores/TasksStore';
import Task from './Task.vue';
import UnlimitedBreakModal from './UnlimitedBreakModal.vue';
import draggable from 'vuedraggable';

export default {
    components: {
        Task,
        UnlimitedBreakModal,
        draggable
    },
    setup() {
        const store = useTasksStore();
        return { store };
    },
    created() {
        this.store.fetchTasks();
        setInterval(() => this.store.fetchTasks(), 10000);
    },
    methods: {
        startDrag(e) {
            this.store.disableFetchingTasks = true;
        },
        endDrag(e) {
            this.store.reorder();
        }
    }
};

</script>