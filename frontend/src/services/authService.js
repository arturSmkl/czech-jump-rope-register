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

export const getUserAuthorization = async (email) => {
  try {
    const docRef = doc(db, 'authorized_users', email);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      // The user is in the authorized_users collection (Whitelisted)
      const data = docSnap.data();
      return {
        isWhitelisted: true,
        role: data.role || null // Returns the role, or null if it's missing
      };
    } else {
      // The user's email is NOT in the collection at all
      return {
        isWhitelisted: false,
        role: null
      };
    }
  } catch (error) {
    console.error("Error fetching user authorization:", error);
    // Fail closed: If Firestore fails (e.g., permissions issue), deny access
    return { isWhitelisted: false, role: null };
  }
};

export const removeUser = async (email) => {
  const docRef = doc(db, COLLECTION_NAME, email.toLowerCase().trim());
  await deleteDoc(docRef);
};
