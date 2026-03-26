<script setup>
import { useAuthStore } from '@/stores/authStore';

const authStore = useAuthStore();
</script>

<template>
  <div class="flex-center mg-t">
    <button v-if="!authStore.isAuthenticated" @click="authStore.login()" class="btn-blue">
      Přihlásit se s účtem Google
    </button>
    <div v-else-if="!authStore.isWhitelisted" class="flex-center flex-column">
      <h2>
        Váš účet není na seznamu povolených uživatelů. Kontaktujte admina pro udělení pravomocí.
      </h2>
      <button @click="authStore.logout()" class="btn-blue mg-t">
        Odhlásit se
      </button>
    </div>
    <div v-else-if="!authStore.role">
      <h2>
        Váš účet nemá žádnou roli. Kontaktujte admina pro udělení pravomocí.
      </h2>
      <button @click="authStore.logout()" class="btn-blue mg-t">
        Odhlásit se
      </button>
    </div>
  </div>
</template>

<style scoped>
.mg-t {
  margin-top: 6rem;
}
</style>
