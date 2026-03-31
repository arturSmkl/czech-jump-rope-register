<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { errorStore } from '@/stores/errorStore';
import {
  downloadCollectiveExport,
  downloadRegisteredExportNsa,
  downloadOverviewPdf
} from '@/services/exportService';

const authStore = useAuthStore();
const route = useRoute();

const isAuthorized = computed(() => authStore.isAuthenticated && authStore.isWhitelisted && !!authStore.role);
const isAdmin = computed(() => authStore.role === 'admin');
const isEditor = computed(() => authStore.role === 'editor');
const canSeeAll = computed(() => isAdmin.value || isEditor.value);
const isImportRoute = computed(() => route.path.startsWith('/import'));
const isMembersRoute = computed(() => route.path.startsWith('/members'));
const isAddRoute = computed(() => route.path.startsWith('/add'));

const roleLabelMap = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Čtenář',
};
const roleLabel = computed(() => roleLabelMap[authStore.role] || authStore.role);

async function handleExport(fn) {
  try {
    await fn();
  } catch (err) {
    errorStore.setError('Export se nezdařil: ' + err.message, 0);
  }
}
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
      <div class="link-dropdown" :class="{ 'active-parent': isMembersRoute }">
        <div class="link flex-center link-members">
          <div class="link-text">ČLENOVÉ</div>
        </div>
        <div class="dropdown-menu">
          <router-link class="dropdown-item" to="/members/active">
            Aktivní členové
          </router-link>
          <router-link class="dropdown-item" to="/members/terminated">
            Zaniklí členové
          </router-link>
        </div>
      </div>
      <div v-if="canSeeAll" class="link-dropdown" :class="{ 'active-parent': isAddRoute }">
        <div class="link flex-center link-add">
          <div class="link-text">PŘIDAT ČLENA</div>
        </div>
        <div class="dropdown-menu">
          <router-link class="dropdown-item" to="/add/collective">
            Kolektivní člen
          </router-link>
          <router-link class="dropdown-item" to="/add/registered">
            Evidovaný člen
          </router-link>
        </div>
      </div>
      <div v-if="canSeeAll" class="link-dropdown" :class="{ 'active-parent': isImportRoute }">
        <div class="link flex-center link-import">
          <div class="link-text">IMPORT</div>
        </div>
        <div class="dropdown-menu">
          <router-link class="dropdown-item" to="/import/collectives">
            Importovat Kolektivní Členy
          </router-link>
          <router-link class="dropdown-item" to="/import/registered">
            Importovat Evidované Členy
          </router-link>
        </div>
      </div>
      <div v-if="canSeeAll" class="link-dropdown">
        <div class="link flex-center link-export">
          <div class="link-text">EXPORT</div>
        </div>
        <div class="dropdown-menu">
          <div class="dropdown-item" @click="handleExport(downloadCollectiveExport)">
            Exportovat kolektivní členy
          </div>
          <div class="dropdown-item" @click="handleExport(downloadRegisteredExportNsa)">
            Exportovat pro rejstřík NSA
          </div>
          <div class="dropdown-item" @click="handleExport(downloadOverviewPdf)">
            Přehled základny (PDF)
          </div>
        </div>
      </div>
      <router-link v-if="isAdmin" class="link flex-center" to="/admin">
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
    position: sticky;
    top: 0;
    z-index: 50;
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
    padding: 0 1rem;
    transition: ease-in-out 0.1s;
  }

  .link.router-link-exact-active {
    background-color: var(--white-95);
  }

  .link:hover {
    background-color: var(--white-95);
  }

  .link:active {
    background-color: var(--white-85);
  }

  .link-dropdown {
    position: relative;
    height: 100px;
  }

  .link-dropdown .link-import,
  .link-dropdown .link-members,
  .link-dropdown .link-add,
  .link-dropdown .link-export {
    height: 100%;
    cursor: default;
  }

  .link-dropdown:hover .link-import,
  .link-dropdown.active-parent .link-import,
  .link-dropdown:hover .link-members,
  .link-dropdown.active-parent .link-members,
  .link-dropdown:hover .link-add,
  .link-dropdown.active-parent .link-add,
  .link-dropdown:hover .link-export {
    background-color: var(--white-95);
  }

  .dropdown-menu {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 260px;
    background-color: var(--white-97);
    box-shadow: 0 4px 8px var(--shadow-color);
    border-radius: 0 0 6px 6px;
    z-index: 100;
    overflow: hidden;
  }

  .link-dropdown:hover .dropdown-menu {
    display: flex;
    flex-direction: column;
  }

  .dropdown-item {
    padding: 0.75rem 1.2rem;
    font-size: 1rem;
    font-weight: 500;
    color: var(--text-color);
    transition: background-color 0.1s ease-in-out;
    white-space: nowrap;
    cursor: pointer;
  }

  .dropdown-item:hover {
    background-color: var(--white-95);
  }

  .dropdown-item:active {
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
    margin-left: 0.5rem;
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
