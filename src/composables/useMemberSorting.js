import { ref } from "vue";

export function useMemberSorting() {
  const sortBy = ref("name");
  const sortOrder = ref("asc");
  const familyMemberSort = ref("role");

  // Sort members array
  const sortMembers = (members) => {
    const sorted = [...members];
    sorted.sort((a, b) => {
      let comparison = 0;
      if (sortBy.value === "name") {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        comparison = nameA.localeCompare(nameB);
      } else if (sortBy.value === "age") {
        comparison = a.age - b.age;
      } else if (sortBy.value === "dateOfBirth") {
        comparison = new Date(a.dateOfBirth) - new Date(b.dateOfBirth);
      }
      return sortOrder.value === "asc" ? comparison : -comparison;
    });
    return sorted;
  };

  // Sort family members
  const sortFamilyMembers = (familyMembers) => {
    const sorted = [...familyMembers];
    
    if (familyMemberSort.value === "role") {
      const rolePriority = {
        'Father': 1,
        'Mother': 2,
        'Spouse': 3,
        'Son': 4,
        'Daughter': 5,
        'Child': 6,
        'Brother': 7,
        'Sister': 7,
      };
      
      sorted.sort((a, b) => {
        const aRole = a.familyRole || '';
        const bRole = b.familyRole || '';
        const aPriority = rolePriority[aRole] || 999;
        const bPriority = rolePriority[bRole] || 999;
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        
        if ((aRole === 'Brother' || aRole === 'Sister') && (bRole === 'Brother' || bRole === 'Sister')) {
          return b.age - a.age;
        }
        
        if (aPriority === bPriority) {
          return b.age - a.age;
        }
        
        return b.age - a.age;
      });
    } else {
      sorted.sort((a, b) => {
        let comparison = 0;
        if (familyMemberSort.value === "name") {
          const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
          const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
          comparison = nameA.localeCompare(nameB);
        } else if (familyMemberSort.value === "age") {
          comparison = a.age - b.age;
        } else if (familyMemberSort.value === "dateOfBirth") {
          comparison = new Date(a.dateOfBirth) - new Date(b.dateOfBirth);
        }
        return sortOrder.value === "asc" ? comparison : -comparison;
      });
    }
    
    return sorted;
  };

  return {
    sortBy,
    sortOrder,
    familyMemberSort,
    sortMembers,
    sortFamilyMembers,
  };
}




