<template>
    <div class="container">
        <div class="my-3">
            <a href="#edit-timesheet-modal" data-bs-toggle="modal" class="btn btn-primary" @click="editedSheet = {}">{{ t('Add time entry') }}</a>
        </div>
        <div class="position-relative">
            <div class="row mt-2 timesheet" v-for="sheet in sheets" :key="sheet.id">
                <div class="col-12 col-lg-8 mb-2 mb-lg-0">
                    <span class="start-date">
                        {{ sheet.startDateAlt }}
                    </span> -
                    <span class="end-date">
                        {{ sheet.endDateAlt }}
                    </span>
                </div>
                <div class="col-6 col-lg-2">
                    {{ sheet.friendlySpentTime }}
                </div>
                <div class="col-6 col-lg-2">
                    <a href="#edit-timesheet-modal" data-bs-toggle="modal" class="me-2" @click="editedSheet = sheet">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </a>
                    <a href="#delete-timesheet-modal" data-bs-toggle="modal" @click="deleteId = sheet.id">
                        <i class="fa-solid fa-trash"></i>
                    </a>
                </div>
            </div>
            <div class="position-absolute top-50 start-50 translate-middle" v-if="loading">
                <div class="spinner-border" style="width: 3rem; height: 3rem;" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
            <div v-if="sheets.length == 0 && !initialLoading">
                {{ t('No time entries recorded yet') }}
            </div>
            <pager :total-pages="totalPages" :current-page="currentPage" @on-page-changed="onPageChanged" />
        </div>
        <delete-timesheet-modal :task-id="deleteId" @task-deleted="onTaskDeleted" />
        <edit-timesheet-modal :task-id="taskId" :sheet="editedSheet" :section-id="sectionId" @task-saved="fetchTimeEntries" />
    </div>
</template>

<script>

import axios from 'axios';
import { filter, find } from 'lodash';
import DeleteTimesheetModal from './DeleteTimesheetModal.vue';
import EditTimesheetModal from './EditTimesheetModal.vue';
import Pager from './Pager.vue';

export default {
    components: {
        EditTimesheetModal,
        DeleteTimesheetModal,
        Pager,
    },
    props: {
        taskId: Number,
        sectionId: Number
    },
    data() {
        return {
            sheets: [],
            editedSheet: {},
            deleteId: null,
            loading: false,
            initialLoading: true,
            currentPage: 1,
            totalPages: 0
        }
    },
    created() {
        this.fetchTimeEntries();
    },
    methods: {
        fetchTimeEntries() {
            this.loading = true;
            axios.get('/?action=plugin-timesheets/timesheets/get&id=' + this.taskId + '&page=' + this.currentPage).then(data => {
                this.sheets = data.data.sheets;
                this.totalPages = data.data.totalPages;
                this.loading = false;
                this.initialLoading = false;
            });
        },
        onTaskDeleted(data) {
            this.fetchTimeEntries();
        },
        onPageChanged(data) {
            this.currentPage = data.page;
            this.fetchTimeEntries();
        }
    }
};

</script>