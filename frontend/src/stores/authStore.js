import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { auth } from '@/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { getUserRole } from '@/services/authService';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const role = ref(null);
  const displayName = ref(null);
  const isInitialLoad = ref(true);

  const isAuthenticated = computed(() => !!user.value);

  // This initializes the listener once
  function init() {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (u) => {
        if (u) {
          user.value = u;
          // Fetch role from your existing authService
          role.value = await getUserRole(u.email);
        } else {
          user.value = null;
          role.value = null;
        }
        isInitialLoad.value = false;
        resolve(u);
      });
    });
  }

  async function login() {
    await signInWithPopup(auth, new GoogleAuthProvider());
  }

  async function logout() {
    await signOut(auth);
  }

  return { user, role, isInitialLoad, isAuthenticated, init, login, logout };
});
