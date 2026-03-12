<script setup>
import { ref, onMounted } from 'vue';
import { getAllAuthorizedUsers, upsertUser, removeUser } from "@/services/authService.js";

const users = ref([]);
const newUserEmail = ref('');
const newUserRole = ref('viewer');

// Fetch the list on load
const loadUsers = async () => {
  users.value = await getAllAuthorizedUsers();
};

const handleAddUser = async () => {
  try {
    await upsertUser(newUserEmail.value, newUserRole.value);
    newUserEmail.value = ''; // Reset form
    await loadUsers(); // Refresh list
    alert("User authorized successfully!");
  } catch (e) {
    alert("Error: You likely don't have Admin permissions.");
    console.error(e);
  }
};

const handleDelete = async (email) => {
  if (confirm(`Remove ${email}?`)) {
    await removeUser(email);
    await loadUsers();
  }
};

onMounted(loadUsers);
</script>

<template>
  <div class="admin-panel">
    <h2>User Authorization Management</h2>

    <div class="form">
      <input v-model="newUserEmail" placeholder="User Email" type="email" />
      <select v-model="newUserRole">
        <option value="viewer">Viewer</option>
        <option value="editor">Editor</option>
        <option value="admin">Admin</option>
      </select>
      <button @click="handleAddUser">Add/Update User</button>
    </div>

    <table>
      <thead>
      <tr>
        <th>Email</th>
        <th>Role</th>
        <th>Actions</th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="user in users" :key="user.email">
        <td>{{ user.email }}</td>
        <td>{{ user.role }}</td>
        <td>
          <button @click="handleDelete(user.email)">Revoke Access</button>
        </td>
      </tr>
      </tbody>
    </table>
  </div>
</template>
