<script setup>
import { useAuthStore } from '@/stores/authStore';
import NavigationBar from "@/components/NavigationBar.vue";
import GlobalAlert from "@/components/GlobalAlert.vue";

const authStore = useAuthStore();
</script>

<template>
  <div id="app">
    <GlobalAlert />
    <navigation-bar></navigation-bar>

    <main class="container">
      <div v-if="authStore.isInitialLoad" class="loader">Loading...</div>

      <router-view v-else />
    </main>
  </div>
</template>

<style>
  .loader {
    font-size: 1.5rem;
    text-align: center;
    margin-top: 2rem;
  }
</style>
