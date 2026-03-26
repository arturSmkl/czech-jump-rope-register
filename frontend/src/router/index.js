import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/DashboardView.vue'),
    // No public meta tag means it is protected by default
  },
  // Catch-all to redirect root to dashboard
  { path: '/', redirect: '/dashboard' }
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

  // Note: Your authStore needs to expose these two distinct states now
  const isWhitelisted = authStore.isWhitelisted;
  const hasRole = !!authStore.role;

  // A user is only fully authorized if they pass all three checks
  const isFullyAuthorized = loggedIn && isWhitelisted && hasRole;

  // 1. Logic for the /login route
  if (to.path === '/login') {
    if (isFullyAuthorized) {
      // Passes all conditions -> redirect to dashboard
      return next('/dashboard');
    }
    // If not logged in, OR logged in but missing whitelist/role, let them stay on /login.
    // The LoginView.vue component will read the store and display the correct messages.
    return next();
  }

  // 2. Logic for protected routes (e.g., /dashboard)
  if (!isFullyAuthorized) {
    // If they try to access a protected route without passing all checks, send them to login
    return next('/login');
  }

  // 3. Specific Role-based check (e.g., Admin only areas inside the app)
  if (to.meta.requiresAdmin && authStore.role !== 'admin') {
    return next('/dashboard');
  }

  next();
});

export default router;
