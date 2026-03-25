<script setup>
import { useAuthStore } from '@/stores/authStore';
import NavigationBar from "@/components/NavigationBar.vue";

const authStore = useAuthStore();
</script>

<template>
  <div id="app">
    <navigation-bar></navigation-bar>

    <main class="container">
      <div v-if="authStore.isInitialLoad" class="spinner">Loading...</div>

      <router-view v-else />
    </main>
  </div>
</template>
