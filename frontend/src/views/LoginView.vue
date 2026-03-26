<script setup>
import { useAuthStore } from '@/stores/authStore';

const authStore = useAuthStore();
</script>

<template>
  <div class="flex-center mg">
    <button @click="authStore.login()" class="btn-blue">
      Přihlásit se s účtem Google
    </button>
  </div>
</template>

<style scoped>
.mg {
  margin-top: 6rem;
}
</style>
