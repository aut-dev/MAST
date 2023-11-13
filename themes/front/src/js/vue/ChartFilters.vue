<template>
    <div class="filters d-flex mb-2">
        <div v-if="tasks" class="d-flex me-2 align-items-center flex-grow-1">
            <label class="me-2 flex-shrink-0">{{ t('Tasks') }}</label>
            <select v-model="filters.tasks" multiple ref="tasksSelect" :placeholder="t('Tasks')">
                <option v-for="task, id in store.tasks" :key="id" :value="id">{{ task }}</option>
            </select>
        </div>
        <div v-if="groupBy" class="d-flex me-2 align-items-center">
            <label class="me-2 flex-shrink-0">{{ t('Group by') }}</label>
            <select v-model="filters.groupBy" class="form-control">
                <option value="days">{{ t('Days') }}</option>
                <option value="months">{{ t('Months') }}</option>
            </select>
        </div>
        <div v-if="dates" class="d-flex">
            <div class="d-flex me-2 align-items-center">
                <label class="me-2 flex-shrink-0">{{ t('From') }}</label>
                <div>
                    <input type="text" class="form-control datepicker" v-model="filters.dateFrom" ref="dateFrom">
                </div>
            </div>
            <div class="d-flex align-items-center">
                <label class="me-2 flex-shrink-0">{{ t('To') }}</label>
                <div>
                    <input type="text" class="form-control datepicker" v-model="filters.dateTo" ref="dateTo">
                </div>
            </div>
        </div>
    </div>
</template>

<script>

import { useAnalyticsStore } from './stores/AnalyticsStore';
import 'multiple-select';

export default {
    setup() {
        const store = useAnalyticsStore();
        return { store };
    },
    props: {
        filters: Object,
        today: String,
        groupBy: {
            type: Boolean,
            default: true
        },
        dates: {
            type: Boolean,
            default: true
        },
        tasks: {
            type: Boolean,
            default: true
        }
    },
    watch: {
        filters: {
            handler() {
                this.$emit('changed', this.filters);
            },
            deep: true
        }
    },
    mounted() {
        import(/* webpackChunkName: "flatpickr" */ '../components/flatpickr').then((chunk) => {
            let options = {
                static: true,
                disableMobile: true,
                altInput: true,
                dateFormat: 'Y-m-d',
                altFormat: 'd/m/Y',
                maxDate: this.store.today
            };
            chunk.flatpickr(this.$refs.dateFrom, options);
            chunk.flatpickr(this.$refs.dateTo, options);
        });
        import(/* webpackChunkName: "multiple-select" */ '../components/multiple-select').then((chunk) => {
            $(this.$refs.tasksSelect).multipleSelect({
                formatSelectAll: () => 'Select all',
                onClose: this.refreshTasksFilter
            });
        });
    },
    methods: {
        refreshTasksFilter() {
            this.filters.tasks = $(this.$refs.tasksSelect).multipleSelect('getSelects');
        }
    }
};

</script>