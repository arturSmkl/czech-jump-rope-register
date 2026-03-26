<script setup>
import { computed } from 'vue';
import { useAuthStore } from '@/stores/authStore';

const authStore = useAuthStore();

const isAuthorized = computed(() => authStore.isAuthenticated && authStore.isWhitelisted && !!authStore.role);
const isAdmin = computed(() => authStore.role === 'admin');
const isEditor = computed(() => authStore.role === 'editor');
const canSeeAll = computed(() => isAdmin.value || isEditor.value);

const roleLabelMap = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Čtenář',
};
const roleLabel = computed(() => roleLabelMap[authStore.role] || authStore.role);
</script>

<template>
  <div class="nav-bar">
    <div class="nav-bar-item">
      <div class="logo"></div>
      <div class="title">
        Czech Jump Rope Register
      </div>
    </div>
    <div class="nav-bar-item" v-if="isAuthorized">
      <router-link class="link flex-center" to="/dashboard">
        <div class="link-text">ČLENOVÉ</div>
      </router-link>
      <router-link v-if="canSeeAll" class="link flex-center" to="/">
        <div class="link-text">PŘIDAT ČLENA</div>
      </router-link>
      <router-link v-if="canSeeAll" class="link flex-center" to="/">
        <div class="link-text">IMPORT</div>
      </router-link>
      <router-link v-if="canSeeAll" class="link flex-center" to="/">
        <div class="link-text">EXPORT</div>
      </router-link>
      <router-link v-if="isAdmin" class="link flex-center" to="/">
        <div class="link-text">ADMIN PANEL</div>
      </router-link>

      <div class="nav-bar-right" v-if="isAuthorized">
        <div class="profile-block">
          <span class="profile-name">{{ authStore.displayName }}</span>
          <span class="profile-role">{{ roleLabel }}</span>
        </div>
        <button class="btn-white" @click="authStore.logout()">Odhlásit se</button>
      </div>
    </div>

  </div>
</template>

<style scoped>
  .nav-bar {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    height: 100px;
    padding: 0 40px;
    background-color: var(--white-97);
    box-shadow: 0 4px 4px var(--shadow-color);
  }
  .nav-bar-item {
    display: flex;
    flex-direction: row;
    justify-content: start;
    align-items: center;
  }
  .logo {
    background-image: url("/logo.png");
    background-repeat: no-repeat;
    background-size: cover;
    height: 60px;
    width: 153px;
    margin-right: 40px;
  }
  .title {
    font-size: 1.6rem;
    font-weight: 600;
  }

  .link {
    height: 100px;
    padding: 0 2rem;
    transition: ease-in-out 0.1s;
  }

  .link:hover {
    background-color: var(--white-95);
  }

  .link:active {
    background-color: var(--white-85);
  }

  .link-text {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-color);
  }

  .nav-bar-right {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 1.5rem;
  }

  .profile-block {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    line-height: 1.3;
  }

  .profile-name {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-color);
  }

  .profile-role {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--primary);
  }
</style>
