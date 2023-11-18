<template>
    <div class="d-relative">
        <Line v-if="loaded" :data="data" :options="options" ref="chartInstance"></Line>
    </div>
</template>

<script>

import { Line } from 'vue-chartjs';
import { useAnalyticsStore } from '../stores/AnalyticsStore';

export default {
    components: {
        Line
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
    data() {
        return {
            options: {
                responsive: true
            }
        }
    },
    watch: {
        'chart.size'() {
            this.$refs.chartInstance.chart.resize();
        },
    },
    props: {
        chartId: [String, Number],
        loaded: Boolean,
        data: Object
    }
};

</script>