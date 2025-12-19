import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "@/firebase"; // import singletons

export async function addCollectiveMember(memberData) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Not authenticated");
  }

  const docRef = await addDoc(collection(db, "CollectiveMembers"), memberData);
  return docRef.id;
}

export async function getAllCollectiveMembers() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Not authenticated");
  }

  const snapshot = await getDocs(collection(db, "CollectiveMembers"));

  // Map snapshot into array of { id, ...data }
  const members = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  return members
}

export async function getCollectiveMemberById(memberId) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Not authenticated");
  }

  const docRef = doc(db, "CollectiveMembers", memberId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    throw new Error("Document not found");
  }

  return { id: snapshot.id, ...snapshot.data() };
}

export async function updateCollectiveMember(memberId, newData) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Not authenticated");
  }

  const docRef = doc(db, "CollectiveMembers", memberId);
  await updateDoc(docRef, newData);
  return docRef.id;
}

export async function deleteCollectiveMember(memberId) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Not authenticated");
  }

  const docRef = doc(db, "CollectiveMembers", memberId);
  await deleteDoc(docRef);
}
