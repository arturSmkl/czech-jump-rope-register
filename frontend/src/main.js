import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
import {errorStore} from "@/stores/errorStore.js";

const app = createApp(App)

app.use(router)

app.config.errorHandler = (err) => {
  console.error("VUE_GLOBAL_ERROR:", err);
  errorStore.setError(err.message || "An unexpected error occurred.");
};

// Catch Unhandled Promise Rejections (This catches your Fetch/Service errors!)
window.addEventListener('unhandledrejection', (event) => {
  console.error("PROMISE_REJECTION:", event.reason);
  errorStore.setError(event.reason.message || "Network or Server error.");
});

app.mount('#app')
