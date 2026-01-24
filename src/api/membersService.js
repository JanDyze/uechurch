import { db } from "./firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";

const MEMBERS_COLLECTION = "members";

// Helper to normalize member data from Firestore
const normalizeMember = (data, docId) => {
  return {
    id: data.id || parseInt(docId) || docId,
    firestoreId: docId,
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    nickname: data.nickname || '',
    sex: data.sex || 'Male',
    dateOfBirth: data.dateOfBirth || null,
    age: data.age || null,
    civilStatus: data.civilStatus || 'Single',
    address: data.address || '',
    contactNumber: data.contactNumber || '',
    occupation: data.occupation || '',
    relatives: data.relatives || {},
    tags: Array.isArray(data.tags) ? data.tags : [],
    isMember: data.isMember !== undefined ? data.isMember : true,
    familyRole: data.familyRole || '',
    image: data.image || null,
  };
};

// Get all members
export const getMembers = async () => {
  try {
    const membersRef = collection(db, MEMBERS_COLLECTION);
    const q = query(membersRef, orderBy("id", "asc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return normalizeMember(data, doc.id);
    });
  } catch (error) {
    console.error("Error getting members:", error);
    throw error;
  }
};

// Subscribe to members changes (real-time)
export const subscribeToMembers = (callback) => {
  const membersRef = collection(db, MEMBERS_COLLECTION);
  
  // Helper to process snapshot
  const processSnapshot = (snapshot) => {
    const members = snapshot.docs.map((doc) => {
      const data = doc.data();
      return normalizeMember(data, doc.id);
    });
    // Sort by numeric id
    members.sort((a, b) => (a.id || 0) - (b.id || 0));
    callback(members);
  };
  
  // Use simple query (orderBy requires index - can be added later in Firebase Console)
  // To enable orderBy, create a composite index on 'id' field in Firebase Console
  return onSnapshot(
    membersRef,
    processSnapshot,
    (error) => {
      console.error("Error subscribing to members:", error);
      callback([]);
    }
  );
};

// Add a new member
export const addMember = async (memberData) => {
  try {
    const membersRef = collection(db, MEMBERS_COLLECTION);
    const docRef = await addDoc(membersRef, memberData);
    return docRef.id;
  } catch (error) {
    console.error("Error adding member:", error);
    throw error;
  }
};

// Update a member (uses Firestore document ID)
export const updateMember = async (firestoreId, memberData) => {
  try {
    const memberRef = doc(db, MEMBERS_COLLECTION, firestoreId);
    // Remove firestoreId and filter out undefined values (Firebase doesn't accept undefined)
    const { firestoreId: _, ...rest } = memberData;
    const dataToUpdate = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== undefined)
    );
    await updateDoc(memberRef, dataToUpdate);
  } catch (error) {
    console.error("Error updating member:", error);
    throw error;
  }
};

// Delete a member (uses Firestore document ID)
export const deleteMember = async (firestoreId) => {
  try {
    const memberRef = doc(db, MEMBERS_COLLECTION, firestoreId);
    await deleteDoc(memberRef);
  } catch (error) {
    console.error("Error deleting member:", error);
    throw error;
  }
};

// Batch update members (for syncing)
export const batchUpdateMembers = async (members) => {
  try {
    const batch = [];
    members.forEach((member) => {
      if (member.id && typeof member.id === "string" && member.id.length > 0) {
        // Update existing member
        const memberRef = doc(db, MEMBERS_COLLECTION, member.id);
        const { id, ...memberData } = member;
        batch.push(updateDoc(memberRef, memberData));
      } else {
        // Add new member
        const { id, ...memberData } = member;
        const membersRef = collection(db, MEMBERS_COLLECTION);
        batch.push(addDoc(membersRef, memberData));
      }
    });
    await Promise.all(batch);
  } catch (error) {
    console.error("Error batch updating members:", error);
    throw error;
  }
};

