<template>
    <div>
        <div class="mb-5">
            <time-per-task :today="today" :last-week="lastWeek"></time-per-task>
        </div>
        <div class="mb-5">
            <derails-per-task :today="today" :last-year="lastYear"></derails-per-task>
        </div>
        <money-per-task :today="today" :last-year="lastYear"></money-per-task>
    </div>
</template>

<script>

import TimePerTask from './charts/TimePerTask.vue';
import DerailsPerTask from './charts/DerailsPerTask.vue';
import MoneyPerTask from './charts/MoneyPerTask.vue';

import 'chart.js/auto';

export default {
    components: {
        TimePerTask,
        DerailsPerTask,
        MoneyPerTask
    },
    props: {
        today: String,
        lastWeek: String,
        lastYear: String
    }
};

</script>