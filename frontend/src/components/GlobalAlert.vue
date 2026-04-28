<template>
  <Transition name="fade">
    <div v-if="errorStore.message" class="global-alert" role="alert">
      <span class="global-alert__message">{{ errorStore.message }}</span>
      <button
        type="button"
        class="global-alert__close"
        aria-label="Zavřít"
        @click="errorStore.clearError"
      >
        &times;
      </button>
    </div>
  </Transition>
</template>

<script setup>
import { errorStore } from '@/stores/errorStore';
</script>

<style scoped>
.global-alert {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 1rem;
  background: #ff6b6b;
  color: white;
  padding: 1rem 1.25rem 1rem 1.5rem;
  border-radius: 8px;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-width: min(90vw, 600px);
}

.global-alert__message {
  flex: 1;
}

.global-alert__close {
  background: transparent;
  border: none;
  color: white;
  font-size: 1.5rem;
  line-height: 1;
  padding: 0 0.25rem;
  cursor: pointer;
  opacity: 0.8;
}

.global-alert__close:hover {
  opacity: 1;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
