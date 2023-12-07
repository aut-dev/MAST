<template>
    <div class="modal fade" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false" ref="modal">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-body">
                    <slot name="title">
                        <div class="mb-3">
                            <label>{{ t('Title') }}</label>
                            <input type="text" v-model="chart.chartTitle" class="form-control">
                            <div class="invalid-feedback d-block" v-if="errors.chartTitle">{{ errors.chartTitle }}</div>
                        </div>
                    </slot>
                    <slot name="size">
                        <div class="mb-3" v-if="!chart.id">
                            <label>{{ t('Size') }}</label>
                            <select v-model="chart.size" class="form-select">
                                <option v-for="label, value in store.sizes" :key="value" :value="value">{{ label }}</option>
                            </select>
                        </div>
                    </slot>
                    <slot name="chartType">
                        <div class="mb-3">
                            <label>{{ t('Data tracked') }}</label>
                            <select v-model="chart.settings.dataTracked" class="form-select">
                                <option v-for="label, value in store.dataTracked" :key="value" :value="value">{{ label }}</option>
                            </select>
                        </div>
                    </slot>
                    <slot name="chartType">
                        <div class="mb-3">
                            <label>{{ t('Type') }}</label>
                            <select v-model="chart.settings.chartType" class="form-select">
                                <option v-for="label, value in store.chartTypes" :key="value" :value="value">{{ label }}</option>
                            </select>
                        </div>
                    </slot>
                    <slot name="tasks">
                        <div class="mb-3">
                            <label for="allTasks">{{ t(' All tasks') }}</label>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" role="switch" id="allTasks" v-model="chart.settings.allTasks">
                            </div>
                        </div>
                        <div class="mb-3">
                            <div v-show="!chart.settings.allTasks">
                                <label>{{ t('Tasks') }}</label>
                                <select v-model="chart.settings.tasks" multiple ref="tasksSelect" :placeholder="t('Tasks')" class="w-100">
                                    <option v-for="task, id in store.tasks" :key="id" :value="id">{{ task.title }}</option>
                                </select>
                                <div class="invalid-feedback d-block" v-if="errors.tasks">{{ errors.tasks }}</div>
                            </div>
                        </div>
                    </slot>
                    <slot name="cumulative">
                        <div v-if="isBarOrLine" class="mb-3">
                            <label for="cumulative">{{ t('Cumulative') }}</label>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" role="switch" id="cumulative" v-model="chart.settings.cumulative">
                            </div>
                        </div>
                    </slot>
                    <slot name="stacked">
                        <div v-if="showStacked" class="mb-3">
                            <label for="stacked">{{ t('Stacked') }}</label>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" role="switch" id="stacked" v-model="chart.stacked">
                            </div>
                        </div>
                    </slot>
                    <slot name="xAxis">
                        <div v-if="showXaxis" class="mb-3">
                            <label>{{ t('X Axis') }}</label>
                            <select v-model="chart.settings.groupBy" class="form-select">
                                <option v-for="label, value in store.groupBys" :key="value" :value="value">{{ label }}</option>
                            </select>
                            <div class="invalid-feedback d-block" v-if="errors.groupBy">{{ errors.groupBy }}</div>
                        </div>
                    </slot>
                    <slot name="dates">
                        <div class="mb-3">
                            <label>{{ t('Date') }}</label>
                            <select v-model="chart.settings.dateRange" class="form-select" ref="dateSelect">
                                <option v-for="label, value in store.dateRanges" :key="value" :value="value">{{ label }}</option>
                            </select>
                        </div>
                        <div class="mb-3" v-show="chart.settings.dateRange == 'custom'">
                            <label>{{ t('From') }}</label>
                            <div>
                                <input type="text" class="form-control datepicker" v-model="chart.settings.dateFrom" ref="dateFrom">
                            </div>
                            <div class="invalid-feedback d-block" v-if="errors.dateFrom">{{ errors.dateFrom }}</div>
                        </div>
                        <div v-show="chart.settings.dateRange == 'custom'">
                            <label>{{ t('To') }}</label>
                            <div>
                                <input type="text" class="form-control datepicker" v-model="chart.settings.dateTo" ref="dateTo">
                            </div>
                            <div class="invalid-feedback d-block" v-if="errors.dateTo">{{ errors.dateTo }}</div>
                        </div>
                    </slot>
                    <slot name="afterFilters"></slot>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" @click="store.openSettings = false;">{{ t('Close') }}</button>
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
import {isEqual, cloneDeep} from 'lodash';

export default {
    setup() {
        const store = useAnalyticsStore();
        return { store };
    },
    data() {
        return {
            modal: null,
            chart: {
                settings: {
                    tasks: []
                }
            },
            errors: {}
        }
    },
    computed: {
        showXaxis() {
            if (this.chart.settings.chartType == 'bar' && this.chart.settings.cumulative) {
                return false;
            }
            return this.isBarOrLine;
        },
        isBarOrLine() {
            return ['line', 'bar'].includes(this.chart.settings.chartType)
        },
        showStacked() {
            return (this.chart.settings.chartType == 'bar' && !this.chart.settings.cumulative);
        }
    },
    watch: {
        'store.openSettings'(open) {
            if (open) {
                this.modal.show();
            } else {
                this.modal.hide();
            }
        },
        'store.editedChart': {
            handler() {
                this.errors = {};
                this.chart = cloneDeep(this.store.editedChart);
            },
            deep: true
        }
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
            this.chart.settings.tasks = $(this.$refs.tasksSelect).multipleSelect('getSelects');
        },
        saveSettings() {
            this.validate();
            if (Object.keys(this.errors).length == 0) {
                this.store.openSettings = false;
                if (!this.chart.id || !isEqual(this.store.editedChart, this.chart)) {
                    let data = {...this.chart.settings};
                    data.chartTitle = this.chart.chartTitle;
                    data.stacked = this.chart.stacked;
                    if (this.chart.id) {
                        let chart = this.store.charts.filter(c => c.id == this.chart.id)[0];
                        chart.chartTitle = this.chart.chartTitle;
                        chart.stacked = this.chart.stacked;
                        chart.settings = this.chart.settings;
                        this.store.saveChart(this.chart.id, data);
                    } else {
                        data.size = this.chart.size;
                        this.store.createChart(data);
                    }
                }
            }
        },
        validate() {
            this.errors = {};
            if (this.chart.settings.dateRange == 'custom') {
                if (!this.chart.settings.dateFrom) {
                    this.errors.dateFrom = 'Date from is required';
                }
                if (!this.chart.settings.dateTo) {
                    this.errors.dateTo = 'Date to is required';
                }
                if (this.chart.settings.dateFrom && this.chart.settings.dateTo) {
                    let dateFrom = moment(this.chart.settings.dateFrom, 'YYYY-MM-DD');
                    let dateTo = moment(this.chart.settings.dateTo, 'YYYY-MM-DD');
                    if (dateFrom.isAfter(dateTo)) {
                        this.errors.dateFrom = 'Date from must be before date to';
                    }
                }
            }
            if (!this.chart.settings.allTasks && this.chart.settings.tasks.length == 0) {
                this.errors.tasks = 'Tasks are required';
            }
            if (!this.chart.chartTitle) {
                this.errors.chartTitle = 'Title is required';
            }
            if (this.chart.settings.chartType == 'line' && !this.chart.settings.groupBy) {
                this.errors.groupBy = 'Group by is required';
            }
        }
    }
};

</script>