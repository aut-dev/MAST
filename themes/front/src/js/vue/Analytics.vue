<template>
    <div>
        <h2 class="mb-4">{{ t('Metrics') }}</h2>
        <ul class="list-group list-group-flush mb-3">
            <li class="list-group-item fw-bold">
                <div class="row">
                    <div class="col-3">{{ t('Task') }}</div>
                    <div class="col-3">{{ t('Time spent') }}</div>
                    <div class="col-2">{{ t('Money spent') }}</div>
                    <div class="col-2">{{ t('Completed') }}</div>
                    <div class="col-2">{{ t('Derails') }}</div>
                </div>
            </li>
            <li class="list-group-item" v-for="task, index in metrics.tasks" :key="index">
                <div class="row">
                    <div class="col-3">{{ task.task.title }}</div>
                    <div class="col-3">{{ task.time }}</div>
                    <div class="col-2">US${{ task.spent }}</div>
                    <div class="col-2">{{ task.completed }}</div>
                    <div class="col-2">{{ task.derails }}</div>
                </div>
            </li>
            <li class="list-group-item fw-bold">
                <div class="row">
                    <div class="col-3">{{ t('Totals') }}</div>
                    <div class="col-3">{{ metrics.totals.time }}</div>
                    <div class="col-2">US${{ metrics.totals.spent }}</div>
                    <div class="col-2">{{ metrics.totals.completed }}</div>
                    <div class="col-2">{{ metrics.totals.derails }}</div>
                </div>
            </li>
        </ul>
        <div class="d-flex justify-content-between mb-4">
            <h2 class="mb-0">{{ t('Charts') }}</h2>
            <div class="dropdown">
                <button class="btn btn-primary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                    {{ t('New chart') }}
                </button>
                <ul class="dropdown-menu">
                    <li><a @click.prevent="store.createChart('derails')" class="dropdown-item" href="#">{{ t('Derails') }}</a></li>
                    <li><a @click.prevent="store.createChart('moneySpent')" class="dropdown-item" href="#">{{ t('Money spent') }}</a></li>
                    <li><a @click.prevent="store.createChart('timeSpent')" class="dropdown-item" href="#">{{ t('Time spent') }}</a></li>
                </ul>
            </div>
        </div>
        <div class="row">
            <div v-for="chart in store.charts" :class="'mb-5 col-12 col-md-' + chart.size">
                <chart :chart-id="'' + chart.id"/>
            </div>
            <div class="col-12" v-if="store.charts.length == 0">
                {{ t('No charts found') }}
            </div>
        </div>
    </div>
</template>

<script>

import Chart from './Chart.vue';
import { useAnalyticsStore } from './stores/AnalyticsStore';

import 'chart.js/auto';

export default {
    setup() {
        const store = useAnalyticsStore();
        return { store };
    },
    components: {
        Chart
    },
    props: {
        tasks: Object,
        today: String,
        lastWeek: String,
        lastYear: String,
        metrics: Object,
        charts: Array
    },
    created() {
        this.store.today = this.today;
        this.store.lastWeek = this.lastWeek;
        this.store.lastYear = this.lastYear;
        this.store.tasks = this.tasks;
        this.store.charts = this.charts;
    }
};

</script>