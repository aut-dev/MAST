<template>
    <div class="filters d-flex mb-2">
        <div v-if="groupBy" class="d-flex me-2 align-items-center">
            <label class="me-2 flex-shrink-0">{{ t('Group by') }}</label>
            <select v-model="filters.groupBy" class="form-control">
                <option value="days">{{ t('Days') }}</option>
                <option value="months">{{ t('Months') }}</option>
            </select>
        </div>
        <div v-if="dates" class="d-flex">
            <div class="d-flex me-2 align-items-center">
                <label class="me-2">{{ t('Date from') }}</label>
                <div>
                    <input type="text" class="form-control datepicker" v-model="filters.dateFrom" ref="dateFrom">
                </div>
            </div>
            <div class="d-flex align-items-center">
                <label class="me-2">{{ t('Date to') }}</label>
                <div>
                    <input type="text" class="form-control datepicker" v-model="filters.dateTo" ref="dateTo">
                </div>
            </div>
        </div>
    </div>
</template>

<script>

export default {
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
                maxDate: this.today
            };
            chunk.flatpickr(this.$refs.dateFrom, options);
            chunk.flatpickr(this.$refs.dateTo, options);
        });
    },
};

</script>