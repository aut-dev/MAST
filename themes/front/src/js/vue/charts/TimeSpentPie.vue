<template>
    <div class="d-relative">
        <Pie v-if="loaded" :data="data" :options="options" ref="chartInstance"></Pie>
    </div>
</template>

<script>

import { Pie } from 'vue-chartjs';

export default {
    components: {
        Pie
    },
    data() {
        return {
            options: {
                responsive: true,
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
        chart: Object,
        loaded: Boolean,
        data: Object
    },
    watch: {
        'chart.size'() {
            this.$refs.chartInstance.chart.resize();
        }
    }
};

</script>