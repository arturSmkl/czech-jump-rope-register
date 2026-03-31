<script setup>
import { ref, onMounted } from 'vue';
import { errorStore } from '@/stores/errorStore';
import { useAuthStore } from '@/stores/authStore';
import {
  getAllAuthorizedUsers,
  upsertUser,
  removeUser
} from '@/services/authService';

const authStore = useAuthStore();

const users = ref([]);
const loading = ref(false);

// Add / edit form
const formEmail = ref('');
const formRole = ref('editor');
const formSaving = ref(false);
const editingEmail = ref(null); // null = adding, string = editing

// Delete modal
const showDeleteModal = ref(false);
const deleteTarget = ref(null);
const deleteLoading = ref(false);

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Čtenář' }
];

function roleLabelFor(role) {
  const found = ROLES.find(r => r.value === role);
  return found ? found.label : role;
}

async function fetchUsers() {
  loading.value = true;
  try {
    users.value = await getAllAuthorizedUsers();
    users.value.sort((a, b) => a.email.localeCompare(b.email));
  } catch (err) {
    errorStore.setError('Nepodařilo se načíst uživatele: ' + err.message);
  } finally {
    loading.value = false;
  }
}

onMounted(fetchUsers);

function startEdit(user) {
  editingEmail.value = user.email;
  formEmail.value = user.email;
  formRole.value = user.role || 'viewer';
}

function cancelEdit() {
  editingEmail.value = null;
  formEmail.value = '';
  formRole.value = 'editor';
}

async function saveUser() {
  const email = formEmail.value.trim();
  if (!email) {
    errorStore.setError('Zadejte emailovou adresu.');
    return;
  }

  formSaving.value = true;
  try {
    await upsertUser(email, formRole.value);
    cancelEdit();
    await fetchUsers();
  } catch (err) {
    errorStore.setError('Chyba při ukládání: ' + err.message, 0);
  } finally {
    formSaving.value = false;
  }
}

function confirmDelete(user) {
  deleteTarget.value = user;
  showDeleteModal.value = true;
}

async function executeDelete() {
  if (!deleteTarget.value) return;
  deleteLoading.value = true;
  try {
    await removeUser(deleteTarget.value.email);
    showDeleteModal.value = false;
    deleteTarget.value = null;
    await fetchUsers();
  } catch (err) {
    errorStore.setError('Chyba při mazání: ' + err.message, 0);
  } finally {
    deleteLoading.value = false;
  }
}

function isSelf(email) {
  return authStore.user?.email?.toLowerCase() === email.toLowerCase();
}
</script>

<template>
  <div class="admin-page">
    <h1 class="admin-heading">Admin Panel</h1>
    <p class="admin-subtitle">Správa oprávněných uživatelů systému</p>

    <!-- Add user form -->
    <div class="form-section">
      <h2>{{ editingEmail ? 'Upravit uživatele' : 'Přidat uživatele' }}</h2>
      <div class="add-form">
        <div class="form-group">
          <label class="form-label">Email</label>
          <input
            class="form-input"
            v-model="formEmail"
            :disabled="!!editingEmail"
            placeholder="uzivatel@example.com"
            @keyup.enter="saveUser"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Role</label>
          <select class="form-select" v-model="formRole">
            <option v-for="r in ROLES" :key="r.value" :value="r.value">{{ r.label }}</option>
          </select>
        </div>
        <div class="add-form-actions">
          <button class="btn-blue btn-sm" :disabled="formSaving" @click="saveUser">
            {{ formSaving ? 'Ukládání…' : 'Uložit' }}
          </button>
          <button v-if="editingEmail" class="btn-white btn-sm" @click="cancelEdit">
            Zrušit
          </button>
        </div>
      </div>
    </div>

    <!-- Users list -->
    <div class="form-section">
      <h2>Oprávnění uživatelé</h2>
      <div v-if="loading" class="loading-text">Načítání…</div>
      <div v-else-if="users.length === 0" class="empty-text">Žádní uživatelé.</div>
      <div v-else class="users-list">
        <div
          v-for="user in users"
          :key="user.email"
          class="user-row"
          :class="{ 'user-self': isSelf(user.email) }"
        >
          <div class="user-info">
            <span class="user-email">{{ user.email }}</span>
            <span class="user-role-badge" :class="'role-' + user.role">{{ roleLabelFor(user.role) }}</span>
          </div>
          <div class="user-actions">
            <button class="btn-white btn-sm" @click="startEdit(user)">
              Upravit
            </button>
            <button
              class="btn-red btn-sm"
              :disabled="isSelf(user.email)"
              :title="isSelf(user.email) ? 'Nemůžete smazat svůj vlastní účet' : ''"
              @click="confirmDelete(user)"
            >
              Smazat
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="showDeleteModal = false">
      <div class="modal-card">
        <h2>Smazat uživatele</h2>
        <p>
          Opravdu chcete odebrat uživatele <strong>{{ deleteTarget?.email }}</strong>?
          Uživatel ztratí přístup do systému.
        </p>
        <div class="modal-actions">
          <button class="btn-white" @click="showDeleteModal = false">Zrušit</button>
          <button class="btn-red" :disabled="deleteLoading" @click="executeDelete">
            {{ deleteLoading ? 'Mazání…' : 'Smazat' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-page {
  max-width: 860px;
  margin: 0 auto;
  padding: 2rem 0 3rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.admin-heading {
  font-size: 1.6rem;
  font-weight: 700;
}

.admin-subtitle {
  font-size: 1rem;
  color: var(--white-65);
  margin-top: -0.75rem;
}

/* Add / edit form */
.add-form {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  flex-wrap: wrap;
}

.add-form .form-group {
  flex: 1;
  min-width: 200px;
}

.add-form-actions {
  display: flex;
  gap: 0.5rem;
  padding-bottom: 2px;
}

/* Users list */
.users-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.user-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background-color: var(--white-97);
  border-radius: 8px;
  border: 2px solid transparent;
  transition: border-color 0.15s;
}

.user-row:hover {
  border-color: var(--white-85);
}

.user-row.user-self {
  border-color: var(--primary);
  background-color: var(--white-95);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-email {
  font-size: 1rem;
  font-weight: 500;
}

.user-role-badge {
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.15rem 0.6rem;
  border-radius: 20px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.role-admin {
  background-color: var(--primary);
  color: var(--white-99);
}

.role-editor {
  background-color: var(--green);
  color: var(--white-99);
}

.role-viewer {
  background-color: var(--white-85);
  color: var(--text-color);
}

.user-actions {
  display: flex;
  gap: 0.5rem;
}

.loading-text,
.empty-text {
  font-size: 1rem;
  color: var(--white-65);
  padding: 1rem 0;
}
</style>
