import { ref, onMounted, onUnmounted } from "vue";
import { subscribeToMembers, addMember, updateMember, deleteMember as deleteMemberDoc } from "../api/membersService";

export function useMembers() {
  const members = ref([]);
  const loading = ref(true);
  let unsubscribe = null;

  // Subscribe to real-time updates from Firestore
  const setupRealtimeListener = () => {
    loading.value = true;
    unsubscribe = subscribeToMembers((updatedMembers) => {
      // Members already have numeric id from Firestore data
      // firestoreId is kept for updates/deletes
      members.value = updatedMembers;
      loading.value = false;
    });
  };

  // Save members to Firestore (adds new member)
  const saveMembers = async () => {
    try {
      // This function is called when adding a new member
      // The actual save happens in useMemberForm via addMember
      // This is kept for backward compatibility
      console.log('saveMembers called - use addMember function instead');
    } catch (e) {
      console.error('Error saving members:', e);
    }
  };

  // Add a new member to Firestore
  const addMemberToFirestore = async (memberData) => {
    try {
      await addMember(memberData);
    } catch (error) {
      console.error('Error adding member to Firestore:', error);
      throw error;
    }
  };

  // Update a member in Firestore (uses Firestore document ID)
  const updateMemberInFirestore = async (member, memberData) => {
    try {
      const firestoreId = member.firestoreId || member.id;
      await updateMember(firestoreId, memberData);
    } catch (error) {
      console.error('Error updating member in Firestore:', error);
      throw error;
    }
  };

  // Delete a member from Firestore (uses Firestore document ID)
  const removeMember = async (member) => {
    try {
      const firestoreId = member.firestoreId || member.id;
      await deleteMemberDoc(firestoreId);
    } catch (error) {
      console.error('Error deleting member from Firestore:', error);
      throw error;
    }
  };

  // Get member by ID
  const getMemberById = (id) => {
    return members.value.find(m => m.id === id);
  };

  // Initialize: Set up real-time listener
  onMounted(() => {
    // No local fallback: onSnapshot reports network failures through its error
    // callback (which already yields an empty list), never as a synchronous
    // throw, so a catch here could only ever mask a programming error — and the
    // sample roster it used to fall back to shipped in the public JS bundle.
    setupRealtimeListener();
  });

  // Cleanup: Unsubscribe when component unmounts
  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });

  return {
    members,
    loading,
    saveMembers,
    addMemberToFirestore,
    updateMemberInFirestore,
    removeMember,
    getMemberById,
  };
}

