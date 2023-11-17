<template>
    <div>
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h4 class="mb-0">{{ chart.title }}</h4>
            <div class="d-flex align-items-center">
                <div class="border border-primary rounded me-2 d-flex chart-size">
                    <div :class="'item border-primary border-end' + (chart.size >= 3 ? ' filled' : '')" @click="saveSize(3)"></div>
                    <div :class="'item border-primary border-end' + (chart.size >= 6 ? ' filled' : '')" @click="saveSize(6)"></div>
                    <div :class="'item border-primary border-end' + (chart.size >= 9 ? ' filled' : '')" @click="saveSize(9)"></div>
                    <div :class="'item border-primary' + (chart.size == 12 ? ' filled' : '')" @click="saveSize(12)"></div>
                </div>
                <a href="#" class="me-2" @click.prevent="chart.openSettings = !chart.openSettings"><i class="fa-solid fa-gear"></i></a>
                <a href="#" @click.prevent="store.deleteChart(this.chart.id)"><i class="fa-solid fa-trash-can"></i></a>
            </div>
        </div>
        <time-spent v-if="chart.type == 'timeSpent'" :chart-id="chart.id"></time-spent>
        <derails v-if="chart.type == 'derails'" :chart-id="chart.id"></derails>
        <money-spent v-if="chart.type == 'moneySpent'" :chart-id="chart.id"></money-spent>
    </div>
</template>

<script>

import TimeSpent from './charts/TimeSpent.vue';
import Derails from './charts/Derails.vue';
import MoneySpent from './charts/MoneySpent.vue';
import { useAnalyticsStore } from './stores/AnalyticsStore';

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
        TimeSpent,
        Derails,
        MoneySpent
    },
    props: {
        chartId: [String, Number]
    },
    methods: {
        saveSize(size) {
            this.chart.size = size;
            this.store.saveChart(this.chart.id, {
                size: size
            });
        }
    }
};

</script>