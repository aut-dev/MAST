<template>
    <div>
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
    computed: {
        chart() {
            return this.store.charts.filter(c => c.id == this.chartId)[0];
        }
    },
    components: {
        Line,
        ChartSettings
    },
    data() {
        return {
            loaded: false,
            data: {},
            options: {
                responsive: true,
                scales: {
                    y: {
                        ticks: {
                            callback: (value) => value + ' mins'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (item) => `${item.dataset.label}: ${item.formattedValue} mins`
                        }
                    }
                }
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
        loadData() {
            if (this.chart) {
                axios.post('/?action=plugin-analytics/charts-data/time-spent', this.chart.filters, {
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