import { reactive } from 'vue';

let _timeout = null;

export const errorStore = reactive({
  message: null,

  setError(msg, duration = 6000) {
    if (_timeout) clearTimeout(_timeout);
    this.message = msg;
    if (duration > 0) {
      _timeout = setTimeout(() => {
        this.message = null;
      }, duration);
    }
  },

  clearError() {
    if (_timeout) clearTimeout(_timeout);
    this.message = null;
  }
});
