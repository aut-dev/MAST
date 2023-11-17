<template>
    <div class="d-relative">
        <chart-settings :chart-id="chartId"></chart-settings>
        <Line v-if="loaded" :data="data" :options="options" ref="chartInstance"></Line>
    </div>
</template>

<script>

import axios from 'axios';

import { Line } from 'vue-chartjs';
import ChartSettings from '../ChartSettings.vue';
import { useAnalyticsStore } from '../stores/AnalyticsStore';

export default {
    setup() {
        const store = useAnalyticsStore();
        return { store };
    },
    components: {
        Line,
        ChartSettings
    },
    computed: {
        chart() {
            return this.store.charts.filter(c => c.id == this.chartId)[0];
        }
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
    props: {
        chartId: [String, Number]
    },
    watch: {
        'chart.size'() {
            this.$refs.chartInstance.chart.resize();
        },
        'chart.filters': {
            handler() {
                this.loadData();
            },
            immediate: true
        }
    },
    methods: {
        onFiltersChanged(e) {
            this.loadData(e);
        },
        loadData() {
            if (this.chart) {
                axios.post('/?action=plugin-analytics/charts-data/derails', this.chart.filters, {
                    headers: {"X-CSRF-Token": Craft.csrfToken}
                }).then((response) => {
                    this.data = response.data;
                    this.loaded = true;
                });
            }
        }
    }
};

</script>