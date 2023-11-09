<template>
    <div>
        <h3>{{ t('Money spent per task') }}</h3>
        <chart-filters :today="today" :filters="filters" @changed="onFiltersChanged"></chart-filters>
        <Line v-if="loaded" :data="data" :options="options"></Line>
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
            },
            options: {
                scales: {
                    y: {
                        ticks: {
                            callback: (value) => '$' + value
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (item) => `$${item.dataset.label}: ${item.formattedValue}`
                        }
                    }
                }
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
            axios.post('/?action=plugin-analytics/analytics/money-per-task', filters, {
                headers: {"X-CSRF-Token": Craft.csrfToken}
            }).then((response) => {
                this.data = response.data;
                this.loaded = true;
            });
        }
    }
};

</script>