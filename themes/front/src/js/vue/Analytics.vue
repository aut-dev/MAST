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
                    <li><a @click.prevent="store.createChart('derails', 'pie')" class="dropdown-item" href="#">{{ t('Derails (Pie)') }}</a></li>
                    <li><a @click.prevent="store.createChart('derails', 'line')" class="dropdown-item" href="#">{{ t('Derails (Line)') }}</a></li>
                    <li><a @click.prevent="store.createChart('moneySpent', 'pie')" class="dropdown-item" href="#">{{ t('Money spent (Pie)') }}</a></li>
                    <li><a @click.prevent="store.createChart('moneySpent', 'line')" class="dropdown-item" href="#">{{ t('Money spent (Line)') }}</a></li>
                    <li><a @click.prevent="store.createChart('timeSpent', 'pie')" class="dropdown-item" href="#">{{ t('Time spent (Pie)') }}</a></li>
                    <li><a @click.prevent="store.createChart('timeSpent', 'line')" class="dropdown-item" href="#">{{ t('Time spent (Line)') }}</a></li>
                </ul>
            </div>
        </div>
        <div class="mb-3">
            <h4>{{ t('Colors') }}</h4>
            <div class="d-flex flex-wrap">
                <div class="d-flex flex-column" v-for="task, index in store.tasks" :key="index">
                    <div class="me-2 mb-2 d-flex align-items-center">
                        <label class="me-2">
                            {{ task.title }}
                        </label>
                        <input type="color" class="form-control form-control-color" :value="task.color ? task.color : '#000000'" title="{{ t('Choose a color') }}" @change="(event) => store.saveColor(task.id, event.target.value)">
                    </div>
                    <div class="invalid-feedback d-block" v-if="store.colorError[task.id]">{{ store.colorError[task.id] }}</div>
                </div>
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
        let settings = {};
        this.charts.forEach(c => {
            settings[c.id] = false;
        });
        this.store.openSettings = settings;
    }
};

</script>