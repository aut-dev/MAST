<template>
    <div>
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h4 class="mb-0">{{ chart.chartTitle }}</h4>
            <div class="d-flex align-items-center">
                <div class="border border-primary rounded me-2 d-none d-md-flex chart-size">
                    <div :class="'item border-primary border-end' + (chart.size >= 3 ? ' filled' : '')" @click="saveSize(3)"></div>
                    <div :class="'item border-primary border-end' + (chart.size >= 6 ? ' filled' : '')" @click="saveSize(6)"></div>
                    <div :class="'item border-primary border-end' + (chart.size >= 9 ? ' filled' : '')" @click="saveSize(9)"></div>
                    <div :class="'item border-primary' + (chart.size == 12 ? ' filled' : '')" @click="saveSize(12)"></div>
                </div>
                <a href="#" class="me-2" @click.prevent="store.openSettings[chartId] = !store.openSettings[chartId]"><i class="fa-solid fa-gear"></i></a>
                <a href="#" @click.prevent="store.deleteChart(this.chart.id)"><i class="fa-solid fa-trash-can"></i></a>
            </div>
        </div>
        <chart-settings :chart-id="chartId"></chart-settings>
        <component :is="chartComponent(chart)" :chart-id="chart.id" :loaded="loaded" :data="data"></component>
    </div>
</template>

<script>

import TimeSpentLine from './charts/TimeSpentLine.vue';
import TimeSpentPie from './charts/TimeSpentPie.vue';
import DerailsPie from './charts/DerailsPie.vue';
import DerailsLine from './charts/DerailsLine.vue';
import MoneySpentPie from './charts/MoneySpentPie.vue';
import MoneySpentLine from './charts/MoneySpentLine.vue';
import ChartSettings from './ChartSettings.vue';
import { useAnalyticsStore } from './stores/AnalyticsStore';
import axios from 'axios';
import {isEqual} from 'lodash';

export default {
    components: {
        ChartSettings,
        TimeSpentLine,
        TimeSpentPie,
        DerailsPie,
        DerailsLine,
        MoneySpentPie,
        MoneySpentLine,
    },
    setup() {
        const store = useAnalyticsStore();
        return { store };
    },
    computed: {
        chart() {
            return this.store.charts.filter(c => c.id == this.chartId)[0];
        }
    },
    props: {
        chartId: [String, Number]
    },
    data() {
        return {
            loaded: false,
            data: {},
            options: {
                responsive: true
            }
        }
    },
    watch: {
        'store.forceChartRedraw'() {
            this.loadData();
        },
        chart: {
            handler(chart, oldChart) {
                if (!isEqual(chart, oldChart)) {
                    this.loadData();
                }
            },
            immediate: true,
            deep: true
        }
    },
    methods: {
        loadData() {
            if (this.chart) {
                axios.post('/?action=plugin-analytics/charts-data', this.chart, {
                    headers: {"X-CSRF-Token": Craft.csrfToken}
                }).then((response) => {
                    this.data = response.data;
                    this.loaded = true;
                });
            }
        },
        saveSize(size) {
            this.store.saveChart(this.chart.id, {
                size: size
            });
        },
        chartComponent(chart) {
            return chart.dataTracked + '-' + chart.chartType;
        }
    }
};

</script>