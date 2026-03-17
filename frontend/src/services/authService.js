import { db } from "@/firebase"; // import singletons
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  collection
} from "firebase/firestore";

const COLLECTION_NAME = "authorized_users";

/**
 * CREATE or UPDATE a user
 * Since we use email as the ID, setDoc handles both.
 */
export const upsertUser = async (email, role) => {
  const docRef = doc(db, COLLECTION_NAME, email.toLowerCase().trim());
  await setDoc(docRef, {
    role: role,
  }, { merge: true });

  return docRef.id;
};

export const getAllAuthorizedUsers = async () => {
  const snapshot = await getDocs(collection(db, COLLECTION_NAME));
  return snapshot.docs.map(doc => ({
    email: doc.id,
    ...doc.data()
  }));
};

export const getUserRole = async (email) => {
  const docRef = doc(db, COLLECTION_NAME, email.toLowerCase().trim());
  const snapshot = await getDoc(docRef);

  if (snapshot.exists()) {
    return snapshot.data().role;
  } else {
    return null; // Not in whitelist
  }
};

export const removeUser = async (email) => {
  const docRef = doc(db, COLLECTION_NAME, email.toLowerCase().trim());
  await deleteDoc(docRef);
};
