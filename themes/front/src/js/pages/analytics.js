import { createApp } from "vue";
import Analytics from '../vue/Analytics.vue';
import { createPinia } from "pinia";
import { Translate } from '../vue/helpers.js';

createApp({
    components: {
        Analytics
    }
})
    .use(createPinia())
    .use(Translate)
    .mount('#analytics-charts');