import { reactive } from 'vue';

export const errorStore = reactive({
  message: null,

  setError(msg) {
    this.message = msg;
  },

  clearError() {
    this.message = null;
  }
});
