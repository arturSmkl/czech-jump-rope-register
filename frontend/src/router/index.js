import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const routes = [
  { path: '/login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  // Wait for Firebase to check the login status on first refresh
  if (authStore.isInitialLoad) await authStore.init();

  const loggedIn = authStore.isAuthenticated;
  const isWhitelisted = !!authStore.role;

  // 1. If it's a public page (Login), let them through
  if (to.meta.public) {
    return loggedIn ? next('/') : next();
  }

  // 2. Not logged in? Go to login.
  if (!loggedIn) return next('/login');

  // 3. Logged in but not whitelisted (no role found in Firestore)?
  if (!isWhitelisted) {
    alert("You are not authorized to access this app.");
    await authStore.logout();
    return next('/login');
  }

  // 4. Role-based check
  if (to.meta.requiresAdmin && authStore.role !== 'admin') {
    return next('/'); // Not an admin? Back to dashboard.
  }

  next();
});

export default router;
