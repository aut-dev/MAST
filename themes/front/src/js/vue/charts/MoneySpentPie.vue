<template>
    <div class="d-relative">
        <Pie v-if="loaded" :data="data" :options="options" ref="chartInstance"></Pie>
    </div>
</template>

<script>

import { Pie } from 'vue-chartjs';
import { useAnalyticsStore } from '../stores/AnalyticsStore';

export default {
    components: {
        Pie
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
                responsive: true,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (item) => `${item.dataset.label}: $${item.formattedValue}`
                        }
                    }
                }
            }
        }
    },
    props: {
        chartId: [String, Number],
        loaded: Boolean,
        data: Object
    },
    watch: {
        'chart.size'() {
            this.$refs.chartInstance.chart.resize();
        }
    },
};

</script>