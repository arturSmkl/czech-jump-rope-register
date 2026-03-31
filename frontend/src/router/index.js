import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

// Role hierarchy: higher number = more permissions
const ROLE_LEVEL = { viewer: 1, editor: 2, admin: 3 };

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
    meta: { memberStatus: 'active', minRole: 'viewer' }
  },
  {
    path: '/members/terminated',
    name: 'MembersTerminated',
    component: () => import('@/views/MembersView.vue'),
    meta: { memberStatus: 'terminated', minRole: 'viewer' }
  },
  {
    path: '/import/collectives',
    name: 'ImportCollectives',
    component: () => import('@/views/ImportView.vue'),
    meta: { importType: 'collectives', minRole: 'editor' }
  },
  {
    path: '/import/registered',
    name: 'ImportRegistered',
    component: () => import('@/views/ImportView.vue'),
    meta: { importType: 'registered', minRole: 'editor' }
  },
  {
    path: '/add/collective',
    name: 'AddCollective',
    component: () => import('@/views/CollectiveMemberFormView.vue'),
    meta: { minRole: 'editor' }
  },
  {
    path: '/add/registered',
    name: 'AddRegistered',
    component: () => import('@/views/RegisteredMemberFormView.vue'),
    meta: { minRole: 'editor' }
  },
  {
    path: '/edit/collective/:id',
    name: 'EditCollective',
    component: () => import('@/views/CollectiveMemberFormView.vue'),
    meta: { minRole: 'editor' }
  },
  {
    path: '/edit/registered/:id',
    name: 'EditRegistered',
    component: () => import('@/views/RegisteredMemberFormView.vue'),
    meta: { minRole: 'editor' }
  },
  {
    path: '/admin',
    name: 'AdminPanel',
    component: () => import('@/views/AdminPanelView.vue'),
    meta: { minRole: 'admin' }
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
  const isWhitelisted = authStore.isWhitelisted;
  const hasRole = !!authStore.role;

  // A user is only fully authorized if they pass all three checks
  const isFullyAuthorized = loggedIn && isWhitelisted && hasRole;

  // 1. Logic for the /login route
  if (to.path === '/login') {
    if (isFullyAuthorized) {
      return next('/members/active');
    }
    return next();
  }

  // 2. If not fully authorized, redirect to login
  if (!isFullyAuthorized) {
    return next('/login');
  }

  // 3. Role-based access check
  const requiredRole = to.meta.minRole;
  if (requiredRole) {
    const userLevel = ROLE_LEVEL[authStore.role] || 0;
    const requiredLevel = ROLE_LEVEL[requiredRole] || 0;
    if (userLevel < requiredLevel) {
      return next('/members/active');
    }
  }

  next();
});

export default router;
