import { db } from "@/firebase"; // import singletons
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where
} from "firebase/firestore";

const COLLECTIVE_COLLECTION_NAME = "collective_members";
const REGISTERED_COLLECTION_NAME = "registered_members";

export const addCollectiveMember = async (memberData) => {
  const docRef = await addDoc(collection(db, COLLECTIVE_COLLECTION_NAME), memberData);
  return docRef.id;
};

export const getAllCollectiveMembers = async () => {
  const snapshot = await getDocs(collection(db, COLLECTIVE_COLLECTION_NAME));

  // Map snapshot into array of { id, ...data }
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

export const getCollectiveMemberById = async (memberId) => {
  const docRef = doc(db, COLLECTIVE_COLLECTION_NAME, memberId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    throw new Error("Document not found");
  }

  return { id: snapshot.id, ...snapshot.data() };
};

export const updateCollectiveMember = async (memberId, newData) => {
  const docRef = doc(db, COLLECTIVE_COLLECTION_NAME, memberId);
  await updateDoc(docRef, newData);
  return docRef.id;
};

export const addRegisteredMember = async (memberData) => {
  if (memberData.collectiveMemberId) {
    const collectiveRef = doc(db, COLLECTIVE_COLLECTION_NAME, memberData.collectiveMemberId);
    const snapshot = await getDoc(collectiveRef);

    if (!snapshot.exists()) {
      throw new Error("Referenced CollectiveMember does not exist");
    }
  }

  const docRef = await addDoc(collection(db, REGISTERED_COLLECTION_NAME), memberData);
  return docRef.id;
};

export const getAllRegisteredMembers = async () => {
  const snapshot = await getDocs(collection(db, REGISTERED_COLLECTION_NAME));

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

export const getRegisteredMemberById = async (memberId) => {
  const docRef = doc(db, REGISTERED_COLLECTION_NAME, memberId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    throw new Error("Document not found");
  }

  return { id: snapshot.id, ...snapshot.data() };
};

export const getRegisteredMembersByCollectiveId = async (collectiveMemberId) => {
  const q = query(
    collection(db, REGISTERED_COLLECTION_NAME),
    where("collectiveMemberId", "==", collectiveMemberId)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

export const updateRegisteredMember = async (memberId, newData) => {
  const docRef = doc(db, REGISTERED_COLLECTION_NAME, memberId);
  await updateDoc(docRef, newData);

  return docRef.id;
};

export const deleteRegisteredMember = async (memberId)=> {
  const docRef = doc(db, REGISTERED_COLLECTION_NAME, memberId);
  await deleteDoc(docRef);
}
