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
    path: '/members/active',
    name: 'MembersActive',
    component: () => import('@/views/MembersView.vue'),
    meta: { memberStatus: 'active' }
  },
  {
    path: '/members/terminated',
    name: 'MembersTerminated',
    component: () => import('@/views/MembersView.vue'),
    meta: { memberStatus: 'terminated' }
  },
  {
    path: '/import/collectives',
    name: 'ImportCollectives',
    component: () => import('@/views/ImportView.vue'),
    meta: { importType: 'collectives' }
  },
  {
    path: '/import/registered',
    name: 'ImportRegistered',
    component: () => import('@/views/ImportView.vue'),
    meta: { importType: 'registered' }
  },
  // Catch-all to redirect root to members
  { path: '/members', redirect: '/members/active' },
  { path: '/', redirect: '/members/active' }
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
      return next('/members/active');
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
    return next('/members/active');
  }

  next();
});

export default router;
