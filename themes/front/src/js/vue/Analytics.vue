<template>
    <div>
        <div class="mb-5">
            <time-per-task></time-per-task>
        </div>
        <div class="mb-5">
            <derails-per-task></derails-per-task>
        </div>
        <money-per-task></money-per-task>
    </div>
</template>

<script>

import TimePerTask from './charts/TimePerTask.vue';
import DerailsPerTask from './charts/DerailsPerTask.vue';
import MoneyPerTask from './charts/MoneyPerTask.vue';
import { useAnalyticsStore } from './stores/AnalyticsStore';

import 'chart.js/auto';

export default {
    setup() {
        const store = useAnalyticsStore();
        return { store };
    },
    components: {
        TimePerTask,
        DerailsPerTask,
        MoneyPerTask
    },
    props: {
        tasks: Object,
        today: String,
        lastWeek: String,
        lastYear: String
    },
    created() {
        this.store.today = this.today;
        this.store.lastWeek = this.lastWeek;
        this.store.lastYear = this.lastYear;
        this.store.tasks = this.tasks;
    }
};

</script>