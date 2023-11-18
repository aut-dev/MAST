<template>
    <div class="d-relative">
        <Line v-if="loaded" :data="data" :options="options" ref="chartInstance"></Line>
    </div>
</template>

<script>

import { Line } from 'vue-chartjs';

export default {
    components: {
        Line
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
        chart: Object,
        loaded: Boolean,
        data: Object
    }
};

</script>