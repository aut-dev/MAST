<template>
    <div>
        <h3>{{ t('Derails per task') }}</h3>
        <chart-filters :filters="filters" @changed="onFiltersChanged"></chart-filters>
        <Line v-if="loaded" :data="data"></Line>
    </div>
</template>

<script>

import axios from 'axios';

import { Line } from 'vue-chartjs';
import ChartFilters from '../ChartFilters.vue';
import { useAnalyticsStore } from '../stores/AnalyticsStore';

export default {
    setup() {
        const store = useAnalyticsStore();
        return { store };
    },
    components: {
        Line,
        ChartFilters
    },
    data() {
        return {
            loaded: false,
            data: {},
            filters: {
                groupBy: 'months',
                dateFrom: null,
                dateTo: null,
                tasks: Object.keys(this.store.tasks)
            }
        }
    },
    created() {
        this.filters.dateFrom = this.store.lastYear;
        this.filters.dateTo = this.store.today
        this.loadData(this.filters);
    },
    methods: {
        onFiltersChanged(e) {
            this.loadData(e);
        },
        loadData(filters) {
            axios.post('/?action=plugin-analytics/analytics/derails-per-task', filters, {
                headers: {"X-CSRF-Token": Craft.csrfToken}
            }).then((response) => {
                this.data = response.data;
                this.loaded = true;
            });
        }
    }
};

</script>