import { ref, computed } from "vue";

export function useMemberFilters(members, searchQuery) {
  const filters = ref({
    tags: [],
    isMember: null,
    sex: null,
    civilStatus: null,
  });

  // Get all unique tags from members
  const allTags = computed(() => {
    const tagSet = new Set();
    members.value.forEach((member) => {
      if (member.tags && Array.isArray(member.tags)) {
        member.tags.forEach((tag) => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  });

  // Filter members based on search and filters
  const filteredMembers = computed(() => {
    let result = [...members.value];

    // Search filter
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      result = result.filter(
        (member) =>
          `${member.firstName || ''} ${member.lastName || ''}`.toLowerCase().includes(query) ||
          member.nickname?.toLowerCase().includes(query) ||
          member.contactNumber?.toLowerCase().includes(query) ||
          member.address?.toLowerCase().includes(query) ||
          member.occupation?.toLowerCase().includes(query)
      );
    }

    // Tag filter
    if (filters.value.tags.length > 0) {
      result = result.filter((member) => {
        if (!member.tags || !Array.isArray(member.tags)) return false;
        return filters.value.tags.some((tag) => member.tags.includes(tag));
      });
    }

    // Member status filter
    if (filters.value.isMember !== null) {
      result = result.filter(
        (member) => member.isMember === filters.value.isMember
      );
    }

    // Sex filter
    if (filters.value.sex) {
      result = result.filter((member) => member.sex === filters.value.sex);
    }

    // Civil status filter
    if (filters.value.civilStatus) {
      result = result.filter(
        (member) => member.civilStatus === filters.value.civilStatus
      );
    }

    return result;
  });

  // Check if any filters are active
  const hasActiveFilters = computed(() => {
    return (
      filters.value.tags.length > 0 ||
      filters.value.isMember !== null ||
      filters.value.sex !== null ||
      filters.value.civilStatus !== null
    );
  });

  // Clear all filters
  const clearFilters = () => {
    filters.value = {
      tags: [],
      isMember: null,
      sex: null,
      civilStatus: null,
    };
  };

  // Toggle tag filter
  const toggleTag = (tag) => {
    const index = filters.value.tags.indexOf(tag);
    if (index > -1) {
      filters.value.tags.splice(index, 1);
    } else {
      filters.value.tags.push(tag);
    }
  };

  return {
    filters,
    allTags,
    filteredMembers,
    hasActiveFilters,
    clearFilters,
    toggleTag,
  };
}

