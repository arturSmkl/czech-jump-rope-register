import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { auth } from '@/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
// Renamed the import to reflect that we are grabbing more than just the role now
import { getUserAuthorization } from '@/services/authService';
import router from '@/router';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const isWhitelisted = ref(false); // NEW: Tracks if the user's document exists
  const role = ref(null);
  const displayName = ref(null);
  const isInitialLoad = ref(true);

  const isAuthenticated = computed(() => !!user.value);

  function init() {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (u) => {
        const wasInitialLoad = isInitialLoad.value;

        if (u) {
          user.value = u;
          displayName.value = u.displayName;

          // Fetch both whitelist status and role from the service
          const authData = await getUserAuthorization(u.email);
          isWhitelisted.value = authData.isWhitelisted;
          role.value = authData.role;

        } else {
          // Reset all state on logout/no user
          user.value = null;
          displayName.value = null;
          isWhitelisted.value = false;
          role.value = null;
        }
        isInitialLoad.value = false;
        resolve(u);

        // After the initial load, navigate programmatically on auth state changes.
        // Use replace to avoid duplicate history entries and catch NavigationDuplicated errors.
        if (!wasInitialLoad) {
          const isFullyAuthorized = !!u && isWhitelisted.value && !!role.value;
          const target = isFullyAuthorized ? '/dashboard' : '/login';
          if (router.currentRoute.value.path !== target) {
            router.push(target).catch(() => {});
          }
        }
      });
    });
  }

  async function login() {
    await signInWithPopup(auth, new GoogleAuthProvider());
  }

  async function logout() {
    await signOut(auth);
    // Explicitly clear state on logout to prevent flash of old data
    user.value = null;
    isWhitelisted.value = false;
    role.value = null;
  }

  return {
    user,
    isWhitelisted,
    role,
    displayName,
    isInitialLoad,
    isAuthenticated,
    init,
    login,
    logout
  };
});
