import { createApp } from "vue";
import Tasks from '../vue/Tasks.vue';
import TasksHeader from '../vue/TasksHeader.vue';
import { createPinia } from "pinia";
import { Translate } from '../vue/helpers.js';
import '../../css/app/components/tasks.scss';

createApp({
    components: {
        Tasks,
        TasksHeader
    }
})
    .use(createPinia())
    .use(Translate)
    .mount('#tasks');