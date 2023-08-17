<template>
    <div class="container">
        <div class="d-flex justify-content-between align-items-center">
            <h1>{{ title }}</h1>
            <a data-bs-toggle="modal" href="#edit-break-modal" @click="editedBreak = {}">
                <i class="fa-solid fa-plus fs-3 text-body"></i>
            </a>
        </div>
        <div class="my-3">
            <div class="form-check">
                <input type="checkbox" class="form-check-input" id="showPast" @change="changeShowPastBreaks" :checked="showPastBreaks">
                <label class="form-check-label" for="showPast">{{ t('Show past breaks') }}</label>
            </div>
        </div>
        <div class="position-relative">
            <div class="row fw-bold mb-2" v-if="breaks.length > 0">
                <div class="col-4">
                    {{ t('Title') }}
                </div>
                <div class="col-3">
                    {{ t('Start date') }}
                </div>
                <div class="col-3">
                    {{ t('End date') }}
                </div>
                <div class="col-2">
                </div>
            </div>
            <div :class="'row mb-2' + (breakk.past ? ' text-light' : '')" v-for="breakk in breaks" :key="breakk.id">
                <div class="col-4">
                    {{ breakk.title }}
                </div>
                <div class="col-3">
                    {{ breakk.startDate }}
                </div>
                <div class="col-3">
                    {{ breakk.endDate }}
                </div>
                <div class="col-2">
                    <a href="#edit-break-modal" data-bs-toggle="modal" class="me-2" @click="cloneBreak(breakk)">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </a>
                    <a href="#delete-break-modal" data-bs-toggle="modal" @click="deleteId = breakk.id">
                        <i class="fa-solid fa-trash"></i>
                    </a>
                </div>
            </div>
            <div class="position-absolute top-50 start-50 translate-middle" v-if="loading">
                <div class="spinner-border" style="width: 3rem; height: 3rem;" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
            <div v-if="breaks.length == 0 && !initialLoading">
                {{ t('You have no breaks defined yet') }}
            </div>
            <pager :total-pages="totalPages" :current-page="currentPage" @on-page-changed="onPageChanged" />
        </div>
        <delete-break-modal :break-id="deleteId" @break-deleted="onBreakDeleted" />
        <edit-break-modal :breakk="editedBreak" :section-id="sectionId" @break-saved="fetchBreaks" />
    </div>
</template>

<script>

import axios from 'axios';
import { filter, find } from 'lodash';
import DeleteBreakModal from './DeleteBreakModal.vue';
import EditBreakModal from './EditBreakModal.vue';
import Pager from './Pager.vue';
import Cookies from 'js-cookie';

export default {
    components: {
        EditBreakModal,
        DeleteBreakModal,
        Pager,
    },
    props: {
        sectionId: Number,
        title: String
    },
    data() {
        return {
            breaks: [],
            editedBreak: {},
            deleteId: null,
            loading: false,
            initialLoading: true,
            showPastBreaks: false,
            currentPage: 1,
            totalPages: 0
        }
    },
    created() {
        this.showPastBreaks = parseInt(Cookies.get('showPastBreaks')) ? true : false;
        console.log(this.showPastBreaks);
        this.fetchBreaks();
    },
    methods: {
        fetchBreaks() {
            this.loading = true;
            axios.get('/?action=plugin-users/breaks/get&page=' + this.currentPage + '&showPast=' + (this.showPastBreaks ? 1 : 0)).then(data => {
                this.breaks = data.data.breaks;
                this.totalPages = data.data.totalPages;
                this.loading = false;
                this.initialLoading = false;
            });
        },
        onBreakDeleted(data) {
            this.fetchBreaks();
        },
        onPageChanged(data) {
            this.currentPage = data.page;
            this.fetchBreaks();
        },
        cloneBreak(breakk) {
            this.editedBreak = Object.assign({}, breakk);
        },
        changeShowPastBreaks()
        {
            this.showPastBreaks = !this.showPastBreaks;
            Cookies.set('showPastBreaks', this.showPastBreaks ? 1 : 0);
            this.fetchBreaks();
        }
    }
};

</script>