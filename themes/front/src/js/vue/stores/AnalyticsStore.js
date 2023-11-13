import { defineStore } from 'pinia';

export const useAnalyticsStore = defineStore('tasks', {
    state: () => ({
        tasks: {},
        today: null,
        lastWeek: null,
        lastYear: null
    })
});