import { reactive } from 'vue';

export const errorStore = reactive({
  message: null,
  type: 'error',

  setError(msg) {
    this.message = msg;
  },

  clearError() {
    this.message = null;
  }
});
