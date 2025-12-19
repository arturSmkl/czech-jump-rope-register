<script setup>
import { auth } from "./firebase.js";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { ref, onMounted } from "vue";
import { addCollectiveMember, getAllCollectiveMembers, getCollectiveMemberById, updateCollectiveMember, deleteCollectiveMember } from "@/servicies/firestoreService.js";

const user = ref(null);

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

const data = {
  name: "Example Name",
  ICO: "12345678",
  contact_person: {
    first_name: "John",
    last_name: "Doe",
    email: "john.doe@example.com",
    phone_number: "+420123456789"
  },
  address: {
    township: "Prague 1",
    postal_number: "11000",
    street_and_desc_number: "Main St 15"
  },
  origin_date: "2023-01-01",
  extinction_date: null
};

function post() {
  if (user.value) {
    addCollectiveMember(data);
  } else {
    console.log("User not signed in");
  }
}

const docsData = ref(null);
async function getAll() {
  if (user.value) {
    docsData.value = await getAllCollectiveMembers();
  }
  else {
    console.log("User not signed in");
  }
}

const docIdGet = ref("");
const docByIdData = ref(null);
async function getById() {
  if (user.value) {
    docByIdData.value = await getCollectiveMemberById(docId.value);
  }
  else {
    console.log("User not signed in");
  }
}

const docIdUpdate = ref("");
async function update() {
  await updateCollectiveMember(docIdUpdate.value, { name: "zesraty potkan" });
}

const docIdDelete = ref("");
async function deleteDocument() {
  await deleteCollectiveMember(docIdDelete.value);
}
</script>

<template>
  <div>
    <button v-if="!user" @click="login">Sign in with Google</button>
    <div v-else>
      <span>Hi, {{ user.displayName || user.uid }}</span>
      <button @click="logout">Sign out</button>
    </div>
    <button @click="post">
      post
    </button>
    <button @click="getAll">
      getAll
    </button>
    <div>
      <h1>GET ALL</h1>
      {{ docsData }}
    </div>
    <div>
      <h1>GET BY ID</h1>
      <input v-model="docIdGet" placeholder="Enter document ID" />
      <button @click="getById">getById</button>
      <div>
      {{ docByIdData }}
      </div>
    </div>
    <div>
      <h1>UPDATE</h1>
      <input v-model="docIdUpdate" placeholder="Enter document ID" />
      <button @click="update">update</button>
    </div>
    <div>
      <h1>DELETE</h1>
      <input v-model="docIdDelete" placeholder="Enter document ID" />
      <button @click="deleteDocument">delete</button>
    </div>
  </div>
</template>
