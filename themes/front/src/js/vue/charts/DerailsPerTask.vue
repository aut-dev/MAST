<template>
    <div>
        <h3>{{ t('Derails per task') }}</h3>
        <chart-filters :today="today" :filters="filters" @changed="onFiltersChanged"></chart-filters>
        <Line v-if="loaded" :data="data"></Line>
    </div>
</template>

<script>

import axios from 'axios';

import { Line } from 'vue-chartjs';
import ChartFilters from '../ChartFilters.vue';

export default {
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
                dateTo: null
            }
        }
    },
    props: {
        today: String,
        lastYear: String
    },
    created() {
        this.filters.dateFrom = this.lastYear;
        this.filters.dateTo = this.today
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