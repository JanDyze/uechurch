import { computed } from "vue";

export function useFamilyGroups(members, filteredMembers, groupByFamily, sortFamilyMembers, sortMembers, sortBy, sortOrder) {
  const familyGroups = computed(() => {
    if (!groupByFamily.value) return [];
    
    let filtered = [...filteredMembers.value];
    const filteredIds = new Set(filtered.map(m => m.id));
    
    const processed = new Set();
    const groups = [];
    const allMemberMap = new Map(members.value.map(m => [m.id, m]));
    const filteredMap = new Map(filtered.map(m => [m.id, m]));
    
    filtered.forEach((member) => {
      if (processed.has(member.id)) return;
      
      const family = new Set([member.id]);
      const queue = [member.id];
      
      while (queue.length > 0) {
        const currentId = queue.shift();
        const current = allMemberMap.get(currentId);
        
        if (!current || !current.relatives) continue;
        
        Object.entries(current.relatives).forEach(([relation, relativeId]) => {
          if (!family.has(relativeId)) {
            family.add(relativeId);
            queue.push(relativeId);
          }
        });
        
        members.value.forEach((m) => {
          if (m.relatives) {
            Object.entries(m.relatives).forEach(([relation, id]) => {
              if (id === currentId && !family.has(m.id)) {
                family.add(m.id);
                queue.push(m.id);
              }
            });
          }
        });
      }
      
      let familyMembers = Array.from(family)
        .map(id => filteredMap.get(id) || allMemberMap.get(id))
        .filter(Boolean);
      
      familyMembers = sortFamilyMembers(familyMembers);
      
      const hasFilteredMember = familyMembers.some(m => filteredIds.has(m.id));
      
      if (hasFilteredMember && (familyMembers.length > 1 || (familyMembers.length === 1 && familyMembers[0].relatives))) {
        groups.push({
          id: familyMembers[0].id,
          members: familyMembers,
        });
        family.forEach(id => processed.add(id));
      }
    });
    
    filtered.forEach((member) => {
      if (!processed.has(member.id) && (!member.relatives || Object.keys(member.relatives).length === 0)) {
        groups.push({
          id: member.id,
          members: [member],
        });
        processed.add(member.id);
      }
    });
    
    groups.sort((a, b) => {
      const memberA = a.members[0];
      const memberB = b.members[0];
      let comparison = 0;
      if (sortBy.value === "name") {
        const nameA = `${memberA.firstName} ${memberA.lastName}`.toLowerCase();
        const nameB = `${memberB.firstName} ${memberB.lastName}`.toLowerCase();
        comparison = nameA.localeCompare(nameB);
      } else if (sortBy.value === "age") {
        comparison = memberA.age - memberB.age;
      } else if (sortBy.value === "dateOfBirth") {
        comparison = new Date(memberA.dateOfBirth) - new Date(memberB.dateOfBirth);
      }
      return sortOrder.value === "asc" ? comparison : -comparison;
    });
    
    return groups;
  });

  return {
    familyGroups,
  };
}

