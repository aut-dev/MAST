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
                <a href="#" class="me-2" @click.prevent="openSettings()"><i class="fa-solid fa-gear"></i></a>
                <a href="#" @click.prevent="store.deleteChart(this.chart.id)"><i class="fa-solid fa-trash-can"></i></a>
            </div>
        </div>
        <component v-if="loaded" :is="this.chart.settings.chartType" :data="data" :options="options" ref="chartInstance"/>
    </div>
</template>

<script>

import { useAnalyticsStore } from './stores/AnalyticsStore';
import { Line, Bar, Pie, PolarArea } from 'vue-chartjs';
import axios from 'axios';
import {isEqual} from 'lodash';

export default {
    components: {
        Line,
        Bar,
        Pie,
        PolarArea
    },
    setup() {
        const store = useAnalyticsStore();
        return { store };
    },
    props: {
        chart: Object
    },
    computed: {
        options() {
            let options = {
                responsive: true,
                plugins: {},
                scales: {}
            };
            if (this.chart.settings.dataTracked == 'timeSpent') {
                options.plugins.tooltip = {
                    callbacks: {
                        label: (item) => `${item.dataset.label}: ` + this.formatTime(item.formattedValue)
                    }
                }
                if (['line', 'bar'].includes(this.chart.settings.chartType)) {
                    options.scales.y = {
                        ticks: {
                            callback: (value) => this.formatTime(value, true)
                        }
                    };
                }
                if (['polar-area'].includes(this.chart.settings.chartType)) {
                    options.scales.r = {
                        ticks: {
                            callback: (value) => this.formatTime(value, true)
                        }
                    };
                }
            } else if (this.chart.settings.dataTracked == 'moneySpent') {
                options.plugins.tooltip = {
                    callbacks: {
                        label: (item) => `${item.dataset.label}: $${item.formattedValue}`
                    }
                }
                if (['line', 'bar'].includes(this.chart.settings.chartType)) {
                    options.scales.y = {
                        ticks: {
                            callback: (value) => '$' + value
                        }
                    };
                }
                if (['polar-area'].includes(this.chart.settings.chartType)) {
                    options.scales.r = {
                        ticks: {
                            callback: (value) => '$' + value
                        }
                    };
                }
            }
            if (this.chart.settings.chartType == 'bar') {
                if (this.chart.stacked) {
                    if (typeof options.scales.y == 'undefined') {
                        options.scales.y = {};
                    }
                    if (typeof options.scales.x == 'undefined') {
                        options.scales.x = {};
                    }
                    options.scales.y.stacked = true;
                    options.scales.x.stacked = true;
                }
                if (this.chart.settings.cumulative) {
                    options.plugins.legend = {
                        display: false
                    };
                }
            }
            return options;
        }
    },
    data() {
        return {
            loaded: false,
            data: {}
        }
    },
    watch: {
        'store.forceChartRedraw'() {
            this.loadData();
        },
        'chart.settings': {
            handler(settings, oldSettings) {
                console.log(settings, oldSettings);
                if (!oldSettings || !isEqual(settings, oldSettings)) {
                    this.loadData();
                }
            },
            immediate: true,
            deep: true
        },
        'chart.size'() {
            this.$refs.chartInstance.chart.resize();
        }
    },
    methods: {
        formatTime(seconds, short = false) {
            if (typeof seconds == 'string') {
                seconds = parseInt(seconds.replace(',', ''));
            }
            let times = [
                {label: 'd', seconds: 86400},
                {label: 'h', seconds: 3600},
                {label: 'm', seconds: 60}
            ];
            let label = '';
            let passes = 0;
            for (let key in times) {
                let time = times[key];
                let val = Math.floor(seconds / time.seconds);
                if (val) {
                    label += val + time.label;
                    seconds = (seconds % time.seconds);
                    passes++;
                    if (short && passes > 1) {
                        break;
                    }
                }
            }
            if (seconds && (!short || passes < 2)) {
                label += seconds + 's';
            }
            if (!label) {
                label = '0s';
            }
            return label;
        },
        openSettings() {
            this.store.editedChart = this.chart;
            this.store.openSettings = true;
        },
        loadData() {
            if (this.chart) {
                axios.post('/?action=plugin-analytics/charts-data', this.chart.settings, {
                    headers: {"X-CSRF-Token": Craft.csrfToken}
                }).then((response) => {
                    this.data = response.data;
                    this.loaded = true;
                });
            }
        },
        saveSize(size) {
            this.chart.size = size;
            this.store.saveChart(this.chart.id, {
                size: size
            });
        }
    }
};

</script>