import { createApp } from "vue";
import TimesheetList from '../vue/TimesheetList.vue';
import { createPinia } from "pinia";
import { Translate } from '../vue/helpers.js';
import '../../css/app/components/task.scss';
import '../../css/app/components/forms.scss';

createApp({
    components: {
        TimesheetList,
    }
})
    .use(createPinia())
    .use(Translate)
    .mount('#timesheet-list');