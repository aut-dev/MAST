<template>
    <div class="modal fade" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false" ref="modal">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-body filters">
                    <slot name="title">
                        <div class="mb-3">
                            <label>{{ t('Title') }}</label>
                            <input type="text" v-model="chartClone.chartTitle" class="form-control">
                            <div class="invalid-feedback d-block" v-if="errors.chartTitle">{{ errors.chartTitle }}</div>
                        </div>
                    </slot>
                    <slot name="chartType">
                        <div class="mb-3">
                            <label>{{ t('Type') }}</label>
                            <select v-model="chartClone.chartType" class="form-select">
                                <option v-for="label, value in store.chartTypes" :key="value" :value="value">{{ label }}</option>
                            </select>
                        </div>
                    </slot>
                    <slot name="tasks">
                        <div class="mb-3">
                            <label for="allTasks">{{ t(' All tasks') }}</label>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" role="switch" id="allTasks" v-model="chartClone.allTasks">
                            </div>
                        </div>
                        <div class="mb-3">
                            <div v-show="!chartClone.allTasks">
                                <label>{{ t('Tasks') }}</label>
                                <select v-model="chartClone.tasks" multiple ref="tasksSelect" :placeholder="t('Tasks')" class="w-100">
                                    <option v-for="task, id in store.tasks" :key="id" :value="id">{{ task.title }}</option>
                                </select>
                                <div class="invalid-feedback d-block" v-if="errors.tasks">{{ errors.tasks }}</div>
                            </div>
                        </div>
                    </slot>
                    <slot name="cumulative">
                        <div v-if="chartClone.chartType == 'line'" class="mb-3">
                            <label for="cumulative">{{ t('Cumulative') }}</label>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" role="switch" id="cumulative" v-model="chartClone.cumulative">
                            </div>
                        </div>
                    </slot>
                    <slot name="groupBy">
                        <div v-if="chartClone.chartType == 'line'" class="mb-3">
                            <label>{{ t('Group by') }}</label>
                            <select v-model="chartClone.groupBy" class="form-select">
                                <option v-for="label, value in store.groupBys" :key="value" :value="value">{{ label }}</option>
                            </select>
                            <div class="invalid-feedback d-block" v-if="errors.groupBy">{{ errors.groupBy }}</div>
                        </div>
                    </slot>
                    <slot name="dates">
                        <div class="mb-3">
                            <label>{{ t('Date') }}</label>
                            <select v-model="chartClone.dateRange" class="form-select" ref="dateSelect">
                                <option v-for="label, value in store.dateRanges" :key="value" :value="value">{{ label }}</option>
                            </select>
                        </div>
                        <div class="mb-3" v-show="chartClone.dateRange == 'custom'">
                            <label>{{ t('From') }}</label>
                            <div>
                                <input type="text" class="form-control datepicker" v-model="chartClone.dateFrom" ref="dateFrom">
                            </div>
                            <div class="invalid-feedback d-block" v-if="errors.dateFrom">{{ errors.dateFrom }}</div>
                        </div>
                        <div v-show="chartClone.dateRange == 'custom'">
                            <label>{{ t('To') }}</label>
                            <div>
                                <input type="text" class="form-control datepicker" v-model="chartClone.dateTo" ref="dateTo">
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
import {isEqual} from 'lodash';

export default {
    setup() {
        const store = useAnalyticsStore();
        return { store };
    },
    props: {
        chart: Object,
        open: Boolean
    },
    data() {
        return {
            modal: null,
            chartClone: {},
            errors: {}
        }
    },
    watch: {
        open(open) {
            if (open) {
                this.modal.show();
            } else {
                this.modal.hide();
            }
        },
        chart: {
            handler() {
                this.chartClone = {...this.chart};
            },
            immediate: true,
            deep: true
        }
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
            this.chartClone.tasks = $(this.$refs.tasksSelect).multipleSelect('getSelects')
        },
        saveSettings() {
            this.validate();
            if (Object.keys(this.errors).length == 0) {
                this.$emit('close');
                if (!this.chart.id || !isEqual(this.chart, this.chartClone)) {
                    let fields = {...this.chartClone};
                    delete fields.id;
                    this.$emit('save', fields);
                }
            }
        },
        closeModal() {
            this.chartClone = {...this.chart};
            this.errors = {};
            this.$emit('close');
        },
        validate() {
            this.errors = {};
            if (this.chartClone.dateRange == 'custom') {
                if (!this.chartClone.dateFrom) {
                    this.errors.dateFrom = 'Date from is required';
                }
                if (!this.chartClone.dateTo) {
                    this.errors.dateTo = 'Date to is required';
                }
                if (this.chartClone.dateFrom && this.chartClone.dateTo) {
                    let dateFrom = moment(this.chartClone.dateFrom, 'YYYY-MM-DD');
                    let dateTo = moment(this.chartClone.dateTo, 'YYYY-MM-DD');
                    if (dateFrom.isAfter(dateTo)) {
                        this.errors.dateFrom = 'Date from must be before date to';
                    }
                }
            }
            if (!this.chartClone.allTasks && $(this.$refs.tasksSelect).multipleSelect('getSelects').length == 0) {
                this.errors.tasks = 'Tasks are required';
            }
            if (!this.chartClone.chartTitle) {
                this.errors.chartTitle = 'Title is required';
            }
            if (this.chartClone.chartType == 'line' && !this.chartClone.groupBy) {
                this.errors.groupBy = 'Group by is required';
            }
        }
    }
};

</script>