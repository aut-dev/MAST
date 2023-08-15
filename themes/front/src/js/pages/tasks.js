import { createApp } from "vue";
import Tasks from '../vue/Tasks.vue';
import TasksHeader from '../vue/TasksHeader.vue';
import { createPinia } from "pinia";
import '../../css/app/components/tasks.scss';

createApp({
    components: {
        Tasks,
        TasksHeader
    }
})
    .use(createPinia())
    .mount('#tasks');