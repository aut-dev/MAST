/* globals Craft */

import { defineStore } from 'pinia';
import axios from 'axios';

export const useAnalyticsStore = defineStore('tasks', {
    state: () => ({
        tasks: {},
        charts: [],
        today: null,
        lastWeek: null,
        lastYear: null,
        forceChartRedraw: 1,
        colorError: {}
    }),
    actions: {
        saveChart(id, fields) {
            axios.post('/?action=plugin-analytics/charts/save-chart', {
                id: id,
                fields: fields
            }, {
                headers: {
                    "X-CSRF-Token": Craft.csrfToken,
                }
            });
        },
        createChart(dataTracked, chartType) {
            axios.post('/?action=plugin-analytics/charts/create-chart', {
                chartType: chartType,
                dataTracked: dataTracked
            }, {
                headers: {
                    "X-CSRF-Token": Craft.csrfToken,
                }
            }).then(data => {
                this.charts.push(data.data);
            });
        },
        deleteChart(id) {
            this.charts = this.charts.filter(c => c.id != id);
            axios.post('/?action=plugin-analytics/charts/delete-chart', {
                id: id
            }, {
                headers: {
                    "X-CSRF-Token": Craft.csrfToken,
                }
            });
        },
        saveColor(id, color) {
            this.colorError[id] = null;
            axios.post('/', {
                action: 'entries/save-entry',
                entryId: id,
                fields: {
                    color: color
                }
            }, {
                headers: {
                    "X-CSRF-Token": Craft.csrfToken,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }).then(() => {
                this.tasks[id].color = color;
                this.forceChartRedraw++;
            }).catch(err => {
                this.colorError[id] = err.response.data.errors.color[0];
            });
        }
    }
});