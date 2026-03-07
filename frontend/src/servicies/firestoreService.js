import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where } from "firebase/firestore";
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

export async function addRegisteredMember(memberData) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not authenticated");
  }

  if (!memberData.collectiveMemberId) {
    throw new Error("collectiveMemberId is required");
  }

  const collectiveRef = doc(db, "CollectiveMembers", memberData.collectiveMemberId);
  const snapshot = await getDoc(collectiveRef);

  if (!snapshot.exists()) {
    throw new Error("Referenced CollectiveMember does not exist");
  }

  const docRef = await addDoc(collection(db, "RegisteredMembers"), memberData);
  return docRef.id;
}

export async function getAllRegisteredMembers() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not authenticated");
  }

  const snapshot = await getDocs(collection(db, "RegisteredMembers"));

  const members = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  return members;
}

export async function getRegisteredMemberById(memberId) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not authenticated");
  }

  const docRef = doc(db, "RegisteredMembers", memberId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    throw new Error("Document not found");
  }

  return { id: snapshot.id, ...snapshot.data() };
}

export async function getRegisteredMembersByCollectiveId(collectiveMemberId) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not authenticated");
  }

  const q = query(
    collection(db, "RegisteredMembers"),
    where("collectiveMemberId", "==", collectiveMemberId)
  );

  const snapshot = await getDocs(q);

  const members = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  return members;
}

export async function updateRegisteredMember(memberId, newData) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not authenticated");
  }

  const docRef = doc(db, "RegisteredMembers", memberId);
  await updateDoc(docRef, newData);

  return docRef.id;
}

export async function deleteRegisteredMember(memberId) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not authenticated");
  }

  const docRef = doc(db, "RegisteredMembers", memberId);
  await deleteDoc(docRef);
}
