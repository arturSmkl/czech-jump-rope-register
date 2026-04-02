<template>
  <Transition name="fade">
    <div v-if="errorStore.message" class="global-alert" @click="errorStore.clearError">
      <span>{{ errorStore.message }}</span>
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
  right: 20px;
  background: #ff6b6b;
  color: white;
  padding: 1rem 2rem;
  border-radius: 8px;
  cursor: pointer;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.5s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
