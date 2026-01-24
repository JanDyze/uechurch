import { ref, computed } from "vue";
import { calculateAgeFromDate } from "../utils/memberUtils";
import { useToast } from "./useToast";

export function useMemberForm(members, addMemberToFirestore, allTags) {
  const toast = useToast();
  const showAddMember = ref(false);
  
  const newMember = ref({
    firstName: '',
    lastName: '',
    nickname: '',
    sex: 'Male',
    dateOfBirth: '',
    age: null,
    civilStatus: 'Single',
    address: '',
    contactNumber: '',
    occupation: '',
    tags: [],
    isMember: false,
    image: null, // Add image field
  });

  // Check if all required fields are filled
  const canAddMember = computed(() => {
    return newMember.value.firstName.trim() !== '' && 
           newMember.value.lastName.trim() !== '' &&
           newMember.value.sex !== '';
  });

  const addMemberTooltip = computed(() => {
    const missing = [];
    if (newMember.value.firstName.trim() === '') missing.push('First Name');
    if (newMember.value.lastName.trim() === '') missing.push('Last Name');
    if (newMember.value.sex === '') missing.push('Gender');
    
    if (missing.length === 0) return '';
    return `Please fill in: ${missing.join(', ')}`;
  });

  // Calculate age from date of birth
  const calculateAge = () => {
    if (newMember.value.dateOfBirth) {
      newMember.value.age = calculateAgeFromDate(newMember.value.dateOfBirth);
    }
  };

  // Add new member
  const addMember = async () => {
    if (!canAddMember.value) {
      return;
    }
    
    const age = calculateAgeFromDate(newMember.value.dateOfBirth);
    
    // Calculate next ID based on existing members
    const nextId = members.value.length > 0 
      ? Math.max(...members.value.map(m => typeof m.id === 'number' ? m.id : parseInt(m.id) || 0), 0) + 1 
      : 1;
    
    const member = {
      id: nextId,
      firstName: newMember.value.firstName.trim(),
      lastName: newMember.value.lastName.trim(),
      nickname: (newMember.value.nickname.trim() || newMember.value.firstName.trim()),
      sex: newMember.value.sex,
      dateOfBirth: newMember.value.dateOfBirth || undefined,
      age: age,
      civilStatus: newMember.value.civilStatus || 'Single',
      address: newMember.value.address.trim() || undefined,
      contactNumber: newMember.value.contactNumber.trim() || undefined,
      occupation: newMember.value.occupation.trim() || undefined,
      relatives: {},
      tags: Array.isArray(newMember.value.tags) ? newMember.value.tags : [],
      isMember: newMember.value.isMember !== undefined ? newMember.value.isMember : true,
      image: newMember.value.image || undefined, // Include image field
    };
    
    // Remove undefined fields (but preserve image even if null)
    Object.keys(member).forEach(key => {
      if (member[key] === undefined && key !== 'image') {
        delete member[key];
      }
    });
    
    // Preserve image field even if null
    if (newMember.value.image === null || newMember.value.image === '') {
      member.image = null;
    }
    
    try {
      // Add to Firestore (real-time listener will update members automatically)
      await addMemberToFirestore(member);
      
      toast.success(`${member.firstName} ${member.lastName} added`);
      
      // Reset form
      newMember.value = {
        firstName: '',
        lastName: '',
        nickname: '',
        sex: 'Male',
        dateOfBirth: '',
        age: null,
        civilStatus: 'Single',
        address: '',
        contactNumber: '',
        occupation: '',
        tags: [],
        isMember: false,
        image: null, // Reset image field
      };
      
      showAddMember.value = false;
    } catch (error) {
      console.error('Error adding member:', error);
      toast.error('Failed to add member. Please try again.');
    }
  };

  return {
    showAddMember,
    newMember,
    canAddMember,
    addMemberTooltip,
    calculateAge,
    addMember,
  };
}

