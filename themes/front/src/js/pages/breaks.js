import { createApp } from "vue";
import BreaksList from "../vue/BreaksList.vue";
import { createPinia } from "pinia";
import { Translate } from "../vue/helpers.js";
import "../../css/app/components/forms.scss";

createApp({
  components: {
    BreaksList,
  },
})
  .use(createPinia())
  .use(Translate)
  .mount("#breaks-list");
