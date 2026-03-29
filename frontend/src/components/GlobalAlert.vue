<template>
  <Transition name="fade">
    <div v-if="errorStore.message" class="global-alert">
      <span>{{ errorStore.message }}</span>
      <button class="alert-close" @click="errorStore.clearError">✕</button>
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
  background: #ff6b6b;
  color: white;
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.alert-close {
  background: none;
  border: none;
  color: white;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.5rem 0.5rem;
  border-radius: 4px;
  line-height: 1;
}

.alert-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.5s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
