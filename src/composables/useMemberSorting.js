import { ref } from "vue";

export function useMemberSorting() {
  const sortBy = ref("name");
  const sortOrder = ref("asc");
  const familyMemberSort = ref("age");

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
        comparison = (a.age || 0) - (b.age || 0);
      } else if (sortBy.value === "dateOfBirth") {
        comparison = new Date(a.dateOfBirth || 0) - new Date(b.dateOfBirth || 0);
      }
      return sortOrder.value === "asc" ? comparison : -comparison;
    });
    return sorted;
  };

  // Sort family members
  const sortFamilyMembers = (familyMembers) => {
    const sorted = [...familyMembers];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      if (familyMemberSort.value === "name") {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        comparison = nameA.localeCompare(nameB);
      } else if (familyMemberSort.value === "age") {
        // Sort by age descending (oldest first)
        comparison = (b.age || 0) - (a.age || 0);
      } else if (familyMemberSort.value === "dateOfBirth") {
        comparison = new Date(a.dateOfBirth || 0) - new Date(b.dateOfBirth || 0);
      }
      return comparison;
    });
    
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
