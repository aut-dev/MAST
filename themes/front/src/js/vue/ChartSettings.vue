<template>
    <div class="modal fade" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false" ref="modal">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-body filters">
                    <slot name="title">
                        <div class="mb-3">
                            <label>{{ t('Title') }}</label>
                            <input type="text" v-model="title" class="form-control">
                            <div class="invalid-feedback d-block" v-if="errors.title">{{ errors.title }}</div>
                        </div>
                    </slot>
                    <slot name="chartType">
                        <div class="mb-3">
                            <label>{{ t('Type') }}</label>
                            <select v-model="chartType" class="form-select">
                                <option value="pie">{{ t('Pie') }}</option>
                                <option value="line">{{ t('Line') }}</option>
                            </select>
                        </div>
                    </slot>
                    <slot name="tasks">
                        <div class="mb-3">
                            <label for="allTasks">{{ t(' All tasks') }}</label>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" role="switch" id="allTasks" v-model="filters.allTasks">
                            </div>
                        </div>
                        <div class="mb-3">
                            <div v-show="!filters.allTasks">
                                <label>{{ t('Tasks') }}</label>
                                <select v-model="filters.tasks" multiple ref="tasksSelect" :placeholder="t('Tasks')" class="w-100">
                                    <option v-for="task, id in store.tasks" :key="id" :value="id">{{ task.title }}</option>
                                </select>
                                <div class="invalid-feedback d-block" v-if="errors.tasks">{{ errors.tasks }}</div>
                            </div>
                        </div>
                    </slot>
                    <slot name="cumulative">
                        <div v-if="chartType == 'line'" class="mb-3">
                            <label for="cumulative">{{ t('Cumulative') }}</label>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" role="switch" id="cumulative" v-model="filters.cumulative">
                            </div>
                        </div>
                    </slot>
                    <slot name="groupBy">
                        <div v-if="chartType == 'line' && groupBys" class="mb-3">
                            <label>{{ t('Group by') }}</label>
                            <select v-model="filters.groupBy" class="form-select">
                                <option v-for="label, value in groupBys" :value="value">{{ label }}</option>
                            </select>
                            <div class="invalid-feedback d-block" v-if="errors.groupBy">{{ errors.groupBy }}</div>
                        </div>
                    </slot>
                    <slot name="dates">
                        <div class="mb-3">
                            <label>{{ t('Date') }}</label>
                            <select v-model="filters.dateRange" class="form-select" ref="dateSelect">
                                <option value="thisWeek">{{ t('This week') }}</option>
                                <option value="lastWeek">{{ t('Last week') }}</option>
                                <option value="thisMonth">{{ t('This month') }}</option>
                                <option value="lastMonth">{{ t('Last month') }}</option>
                                <option value="thisYear">{{ t('This year') }}</option>
                                <option value="lastYear">{{ t('Last year') }}</option>
                                <option value="custom">{{ t('Custom') }}</option>
                            </select>
                        </div>
                        <div class="mb-3" v-show="filters.dateRange == 'custom'">
                            <label>{{ t('From') }}</label>
                            <div>
                                <input type="text" class="form-control datepicker" v-model="filters.dateFrom" ref="dateFrom">
                            </div>
                            <div class="invalid-feedback d-block" v-if="errors.dateFrom">{{ errors.dateFrom }}</div>
                        </div>
                        <div v-show="filters.dateRange == 'custom'">
                            <label>{{ t('To') }}</label>
                            <div>
                                <input type="text" class="form-control datepicker" v-model="filters.dateTo" ref="dateTo">
                            </div>
                            <div class="invalid-feedback d-block" v-if="errors.dateTo">{{ errors.dateTo }}</div>
                        </div>
                    </slot>
                    <slot name="afterFilters"></slot>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" @click="closeModal()">{{ t('Close') }}</button>
                    <button type="button" class="btn btn-primary" @click="saveSettings()">{{ t('Save') }}</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>

import { useAnalyticsStore } from './stores/AnalyticsStore';
import 'multiple-select';
import moment from 'moment';

export default {
    setup() {
        const store = useAnalyticsStore();
        return { store };
    },
    props: {
        chartId: [String, Number],
        groupBys: {
            type: [Boolean, Object],
            default: {
                days: 'Days',
                months: 'Months',
            }
        }
    },
    computed: {
        chart() {
            return this.store.charts.filter(c => c.id == this.chartId)[0];
        }
    },
    data() {
        return {
            modal: null,
            title: null,
            chartType: null,
            filters: {},
            errors: {},
        }
    },
    watch: {
        chartType(type) {
            $(this.$refs.tasksSelect).multipleSelect('setSelects', this.filters.tasks);
        },
        'chart.openSettings': {
            handler() {
                this.updateModal();
            },
            immediate: true
        },
        'chart.title': {
            handler() {
                this.title = this.chart.title ?? '';
            },
            immediate: true
        },
        'chart.chartType': {
            handler() {
                this.chartType = this.chart.chartType ?? '';
            },
            immediate: true
        },
        'chart.filters': {
            handler() {
                this.filters = this.chart ? {...this.chart.filters} : {};
            },
            immediate: true
        }
    },
    created() {
        this.chart.openSettings = false;
    },
    unmounted() {
        this.modal.dispose();
    },
    mounted() {
        App.getBootstrap().then(chunk => {
            this.modal = new chunk.Modal(this.$refs.modal);
        });
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
                formatSelectAll: () => '(Un)Select all',
                onClick: () => this.updateTasks(),
                onCheckAll: () => this.updateTasks(),
                onUncheckAll: () => this.updateTasks(),
            });
        });
    },
    methods: {
        updateTasks() {
            this.filters.tasks = $(this.$refs.tasksSelect).multipleSelect('getSelects')
        },
        updateModal() {
            if (this.modal && this.chart) {
                if (this.chart.openSettings) {
                    this.modal.show();
                } else {
                    this.modal.hide();
                }
            }
        },
        saveSettings() {
            this.validate();
            if (Object.keys(this.errors).length == 0) {
                this.chart.openSettings = false;
                this.chart.title = this.title;
                this.chart.chartType = this.chartType;
                this.chart.filters = {...this.filters};
                this.store.saveChart(this.chart.id, {
                    chartTitle: this.title,
                    chartType: this.chartType,
                    filters: JSON.stringify(this.filters)
                });
            }
        },
        closeModal() {
            this.title = this.chart.title;
            this.chartType = this.chart.chartType;
            this.filters = {...this.chart.filters}
            this.chart.openSettings = false;
            this.errors = {};
        },
        validate() {
            this.errors = {};
            if (this.filters.dateRange == 'custom') {
                if (!this.filters.dateFrom) {
                    this.errors.dateFrom = 'Date from is required';
                }
                if (!this.filters.dateTo) {
                    this.errors.dateTo = 'Date to is required';
                }
                if (this.filters.dateFrom && this.filters.dateTo) {
                    let dateFrom = moment(this.filters.dateFrom, 'YYYY-MM-DD');
                    let dateTo = moment(this.filters.dateTo, 'YYYY-MM-DD');
                    if (dateFrom.isAfter(dateTo)) {
                        this.errors.dateFrom = 'Date from must be before date to';
                    }
                }
            }
            if (!this.filters.allTasks && $(this.$refs.tasksSelect).multipleSelect('getSelects').length == 0) {
                this.errors.tasks = 'Tasks are required';
            }
            if (!this.title) {
                this.errors.title = 'Title is required';
            }
            if (this.chartType == 'line' && !this.filters.groupBy) {
                this.errors.groupBy = 'Group by is required';
            }
        }
    }
};

</script>