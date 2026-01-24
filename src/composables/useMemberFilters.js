import { ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

export function useMemberFilters(members, searchQuery) {
  const route = useRoute();
  const router = useRouter();

  // Default filter state
  const defaultFilters = {
    tags: [],
    isMember: null,
    sex: null,
    civilStatus: null,
    hasAddress: null,
    hasOccupation: null,
  };

  const filters = ref({ ...defaultFilters });

  // Initialize filters from URL on mount
  const initFiltersFromUrl = () => {
    const query = route.query;
    
    if (query.tags) {
      filters.value.tags = query.tags.split(',').filter(Boolean);
    }
    if (query.isMember !== undefined) {
      filters.value.isMember = query.isMember === 'true' ? true : query.isMember === 'false' ? false : null;
    }
    if (query.sex) {
      filters.value.sex = query.sex;
    }
    if (query.civilStatus) {
      filters.value.civilStatus = query.civilStatus;
    }
    if (query.hasAddress !== undefined) {
      filters.value.hasAddress = query.hasAddress === 'true' ? true : query.hasAddress === 'false' ? false : null;
    }
    if (query.hasOccupation !== undefined) {
      filters.value.hasOccupation = query.hasOccupation === 'true' ? true : query.hasOccupation === 'false' ? false : null;
    }
  };

  // Call init on setup
  initFiltersFromUrl();

  // Update URL when filters change
  const updateUrlWithFilters = () => {
    const query = { ...route.query };
    
    // Remove filter panel param and all filter params first
    delete query.filter;
    delete query.tags;
    delete query.isMember;
    delete query.sex;
    delete query.civilStatus;
    delete query.hasAddress;
    delete query.hasOccupation;
    
    // Add active filters
    if (filters.value.tags.length > 0) {
      query.tags = filters.value.tags.join(',');
    }
    if (filters.value.isMember !== null) {
      query.isMember = String(filters.value.isMember);
    }
    if (filters.value.sex) {
      query.sex = filters.value.sex;
    }
    if (filters.value.civilStatus) {
      query.civilStatus = filters.value.civilStatus;
    }
    if (filters.value.hasAddress !== null) {
      query.hasAddress = String(filters.value.hasAddress);
    }
    if (filters.value.hasOccupation !== null) {
      query.hasOccupation = String(filters.value.hasOccupation);
    }
    
    router.replace({ query });
  };

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

  // Get all unique occupations from members
  const allOccupations = computed(() => {
    const occSet = new Set();
    members.value.forEach((member) => {
      if (member.occupation) {
        occSet.add(member.occupation);
      }
    });
    return Array.from(occSet).sort();
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

    // Has address filter
    if (filters.value.hasAddress !== null) {
      if (filters.value.hasAddress) {
        result = result.filter((member) => member.address && member.address.trim() !== '');
      } else {
        result = result.filter((member) => !member.address || member.address.trim() === '');
      }
    }

    // Has occupation filter
    if (filters.value.hasOccupation !== null) {
      if (filters.value.hasOccupation) {
        result = result.filter((member) => member.occupation && member.occupation.trim() !== '');
      } else {
        result = result.filter((member) => !member.occupation || member.occupation.trim() === '');
      }
    }

    return result;
  });

  // Check if any filters are active
  const hasActiveFilters = computed(() => {
    return (
      filters.value.tags.length > 0 ||
      filters.value.isMember !== null ||
      filters.value.sex !== null ||
      filters.value.civilStatus !== null ||
      filters.value.hasAddress !== null ||
      filters.value.hasOccupation !== null
    );
  });

  // Apply filters (called from drawer)
  const applyFilters = (newFilters) => {
    filters.value = { ...newFilters };
    updateUrlWithFilters();
  };

  // Clear all filters
  const clearFilters = () => {
    filters.value = { ...defaultFilters };
    updateUrlWithFilters();
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
    allOccupations,
    filteredMembers,
    hasActiveFilters,
    applyFilters,
    clearFilters,
    toggleTag,
  };
}
