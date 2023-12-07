import { createApp } from "vue";
import Analytics from '../vue/Analytics.vue';
import { createPinia } from "pinia";
import { Translate } from '../vue/helpers.js';
import '../../css/app/components/analytics.scss';

createApp({
    components: {
        Analytics
    }
})
    .use(createPinia())
    .use(Translate)
    .mount('#analytics');