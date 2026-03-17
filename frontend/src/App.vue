<script setup>
import { ref, onMounted } from "vue";
import { auth } from "@/firebase";
import {
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged
} from "firebase/auth";

import {
  // CollectiveMembers
  addCollectiveMember,
  getAllCollectiveMembers,
  getCollectiveMemberById,
  updateCollectiveMember,
  deleteCollectiveMember,

  // RegisteredMembers
  addRegisteredMember,
  getAllRegisteredMembers,
  getRegisteredMemberById,
  getRegisteredMembersByCollectiveId,
  updateRegisteredMember,
  deleteRegisteredMember

} from "@/services/firestoreService.js";
import AdminPanel from "@/components/AdminPanel.vue";
import CsvImporterCollective from "@/components/CsvImporterCollective.vue";
import CsvImporterRegistered from "@/components/CsvImporterRegistered.vue";


// ---------------------
// AUTH
// ---------------------
const user = ref(null);

onMounted(() => {
  onAuthStateChanged(auth, async (u) => {
    if (u) {
      user.value = {
        uid: u.uid,
        displayName: u.displayName,
        email: u.email
      };

      const token = await u.getIdToken();

      console.log("Signed in");
      console.log("User ID:", u.uid);
      console.log("Display Name:", u.displayName);
      console.log("ID Token:", token);
    } else {
      user.value = null;
      console.log("Signed out");
    }
  });
});

const login = () => signInWithPopup(auth, new GoogleAuthProvider());
const logout = () => signOut(auth);

// ---------------------
// TEST STATE
// ---------------------
const collectiveId = ref("");
const registeredId = ref("");
const collectiveList = ref([]);
const registeredList = ref([]);


// ---------------------
// Collective CRUD
// ---------------------

const createCollective = async () => {
  const id = await addCollectiveMember({
    name: "Test Collective",
    createdAt: new Date()
  });
  collectiveId.value = id;
  console.log("Created Collective:", id);
};

const loadCollectives = async () => {
  collectiveList.value = await getAllCollectiveMembers();
  console.log(collectiveList.value);
};

const loadCollectiveById = async () => {
  const result = await getCollectiveMemberById(collectiveId.value);
  console.log(result);
};

const updateCollective = async () => {
  await updateCollectiveMember(collectiveId.value, {
    name: "Updated Collective"
  });
  console.log("Collective updated");
};

const removeCollective = async () => {
  await deleteCollectiveMember(collectiveId.value);
  console.log("Collective deleted");
};


// ---------------------
// Registered CRUD
// ---------------------

const createRegistered = async () => {
  const id = await addRegisteredMember({
    name: "Test Person",
    role: "Tester",
    collective_member_ref: collectiveId.value
  });
  registeredId.value = id;
  console.log("Created Registered Member:", id);
};

const loadRegistered = async () => {
  registeredList.value = await getAllRegisteredMembers();
  console.log(registeredList.value);
};

const loadRegisteredById = async () => {
  const result = await getRegisteredMemberById(registeredId.value);
  console.log(result);
};

const loadByCollective = async () => {
  const result = await getRegisteredMembersByCollectiveId(collectiveId.value);
  console.log(result);
};

const updateRegistered = async () => {
  await updateRegisteredMember(registeredId.value, {
    role: "Updated Role"
  });
  console.log("Registered Member updated");
};

const removeRegistered = async () => {
  await deleteRegisteredMember(registeredId.value);
  console.log("Registered Member deleted");
};

</script>

<template>
  <div>
    <h1>Firestore CRUD Test</h1>

    <div v-if="!user">
      <button @click="login">Login with Google</button>
    </div>

    <div v-else>
      <p>Logged in as: {{ user.displayName }}, {{ user.email }}</p>
      <button @click="logout">Logout</button>

      <hr />

      <h2>CollectiveMembers</h2>

      <button @click="createCollective">Create Collective</button>
      <button @click="loadCollectives">Get All Collectives</button>
      <button @click="loadCollectiveById">Get Collective By ID</button>
      <button @click="updateCollective">Update Collective</button>
      <button @click="removeCollective">Delete Collective</button>

      <p>Current Collective ID: {{ collectiveId }}</p>

      <hr />

      <h2>RegisteredMembers</h2>

      <button @click="createRegistered">Create Registered Member</button>
      <button @click="loadRegistered">Get All Registered</button>
      <button @click="loadRegisteredById">Get Registered By ID</button>
      <button @click="loadByCollective">Get By Collective ID</button>
      <button @click="updateRegistered">Update Registered</button>
      <button @click="removeRegistered">Delete Registered</button>

      <p>Current Registered ID: {{ registeredId }}</p>

      <admin-panel></admin-panel>
      <csv-importer-collective></csv-importer-collective>
      <csv-importer-registered></csv-importer-registered>

    </div>
  </div>
</template>
