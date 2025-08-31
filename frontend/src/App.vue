<script setup lang="ts">
import { auth } from "./firebase";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { ref, onMounted } from "vue";

const user = ref<null | { uid: string; displayName: string | null }>(null);

onMounted(() => {
  onAuthStateChanged(auth, async (u) => {
    if (u) {
      // Store the user in your reactive state
      user.value = {
        uid: u.uid,
        displayName: u.displayName
      };

      // Fetch the current ID token
      const token = await u.getIdToken();

      // Log helpful info
      console.log("Signed in");
      console.log("User ID:", u.uid);
      console.log("Display Name:", u.displayName);
      console.log("ID Token:", token);
    } else {
      // Clear state if signed out
      user.value = null;

      console.log("Signed out");
    }
  });
});

const login = () => signInWithPopup(auth, new GoogleAuthProvider());
const logout = () => signOut(auth);
</script>

<template>
  <div>
    <button v-if="!user" @click="login">Sign in with Google</button>
    <div v-else>
      <span>Hi, {{ user.displayName || user.uid }}</span>
      <button @click="logout">Sign out</button>
    </div>
  </div>
</template>
