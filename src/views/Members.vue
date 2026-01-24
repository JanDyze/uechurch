<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useMembers } from "../composables/useMembers";
import { useMemberFilters } from "../composables/useMemberFilters";
import { useMemberSorting } from "../composables/useMemberSorting";
import { useMemberForm } from "../composables/useMemberForm";
import { useToast } from "../composables/useToast";
import MembersToolbar from "../components/members/MembersToolbar.vue";
import FilterDrawer from "../components/members/FilterDrawer.vue";
import ConfigDrawer from "../components/members/ConfigDrawer.vue";
import AddMemberDrawer from "../components/members/AddMemberDrawer.vue";
import MemberDetailsDrawer from "../components/members/MemberDetailsDrawer.vue";
import MemberContextMenu from "../components/members/MemberContextMenu.vue";
import ExportDialog from "../components/members/ExportDialog.vue";
import MemberCard from "../components/members/MemberCard.vue";
import MemberListItem from "../components/members/MemberListItem.vue";
import MemberCardSkeleton from "../components/members/MemberCardSkeleton.vue";
import ConfirmationModal from "../components/common/ConfirmationModal.vue";
import { exportToExcel } from "../utils/exportUtils";
import { getFullName } from "../utils/memberUtils";

const toast = useToast();

const router = useRouter();
const route = useRoute();

const searchQuery = ref("");

// Member data management
const { members, loading, addMemberToFirestore, updateMemberInFirestore, removeMember } = useMembers();

// Filters
const { filters, allTags, filteredMembers: baseFilteredMembers, hasActiveFilters, applyFilters, clearFilters } = useMemberFilters(members, searchQuery);

// Sorting
const { sortBy, sortOrder, sortMembers } = useMemberSorting();

// Apply sorting to filtered members
const filteredMembers = computed(() => {
  return sortMembers(baseFilteredMembers.value);
});

// View state with URL params
const activeDrawer = ref(null);

// LocalStorage keys
const STORAGE_KEY_LAYOUT = 'members_layout';
const STORAGE_KEY_VIEW_MODE = 'members_viewMode';

// Get saved preferences from localStorage
const getSavedLayout = () => localStorage.getItem(STORAGE_KEY_LAYOUT) || 'grid';
const getSavedViewMode = () => localStorage.getItem(STORAGE_KEY_VIEW_MODE) || 'simple';

// View mode: 'simple' or 'detailed'
const viewMode = computed({
  get: () => route.query.viewMode || getSavedViewMode(),
  set: (value) => {
    localStorage.setItem(STORAGE_KEY_VIEW_MODE, value);
    updateQueryParams({ viewMode: value });
  }
});

// Layout mode: 'grid' or 'list'
const layoutMode = computed({
  get: () => route.query.layout || getSavedLayout(),
  set: (value) => {
    localStorage.setItem(STORAGE_KEY_LAYOUT, value);
    updateQueryParams({ layout: value });
  }
});
const showExport = ref(false);
const selectedMember = ref(null);
const showDetails = ref(false);

// Field visibility configuration
const visibleFields = ref({
  dateOfBirth: true,
  age: true,
  civilStatus: true,
  occupation: true,
  contactNumber: true,
  address: true,
});

// Member form
const { showAddMember, newMember, canAddMember, addMemberTooltip, calculateAge, addMember } = useMemberForm(
  members,
  addMemberToFirestore,
  allTags
);

// URL query parameter helpers
const updateQueryParams = (params) => {
  const query = { ...route.query };
  
  // Remove null/false params
  Object.keys(params).forEach(key => {
    if (params[key] === null || params[key] === false || params[key] === undefined) {
      delete query[key];
    } else {
      query[key] = params[key];
    }
  });
  
  router.replace({ query });
};

// Handle layout switch (updates both layout and viewMode in one call)
const handleSwitchLayout = ({ layout, viewMode: newViewMode }) => {
  localStorage.setItem(STORAGE_KEY_LAYOUT, layout);
  localStorage.setItem(STORAGE_KEY_VIEW_MODE, newViewMode);
  updateQueryParams({ layout, viewMode: newViewMode });
};

// Track if filters were just applied (to avoid URL conflicts)
const filtersJustApplied = ref(false);

// Computed properties for drawer visibility with URL params
const showFilters = computed({
  get: () => route.query.filter === 'true',
  set: (value) => {
    if (value) {
      showAddMember.value = false;
      showDetails.value = false;
      selectedMember.value = null;
      filtersJustApplied.value = false;
      updateQueryParams({ filter: 'true', add: null, view: null });
    } else if (!filtersJustApplied.value) {
      // Only remove filter param if we're just closing (not applying)
      updateQueryParams({ filter: null });
    }
    // Reset flag
    filtersJustApplied.value = false;
  }
});

// Wrap applyFilters to set flag before closing drawer
const handleApplyFilters = (newFilters) => {
  filtersJustApplied.value = true;
  applyFilters(newFilters);
  
  // Count active filters for toast message
  const activeCount = [
    newFilters.tags?.length > 0,
    newFilters.isMember !== null,
    newFilters.sex !== null,
    newFilters.civilStatus !== null,
    newFilters.hasAddress !== null,
    newFilters.hasOccupation !== null,
  ].filter(Boolean).length;
  
  if (activeCount > 0) {
    toast.success(`${activeCount} filter${activeCount > 1 ? 's' : ''} applied`);
  } else {
    toast.info('Filters cleared');
  }
};

// Wrap clearFilters to show toast
const handleClearFilters = () => {
  clearFilters();
  toast.info('All filters cleared');
};

const showConfig = computed({
  get: () => activeDrawer.value === 'config',
  set: (value) => {
    if (value) {
      showAddMember.value = false;
      showDetails.value = false;
      selectedMember.value = null;
      activeDrawer.value = 'config';
      updateQueryParams({ filter: null, add: null, view: null });
    } else {
      activeDrawer.value = null;
    }
  }
});

// Computed property for showAddMember to work with v-model and URL params
const showAddMemberComputed = computed({
  get: () => route.query.add === 'true',
  set: (value) => {
    if (value) {
      activeDrawer.value = null;
      showDetails.value = false;
      selectedMember.value = null;
      showAddMember.value = true;
      updateQueryParams({ add: 'true', filter: null, view: null });
    } else {
      showAddMember.value = false;
      updateQueryParams({ add: null });
    }
  }
});

// Computed for details drawer with URL params
const showDetailsComputed = computed({
  get: () => !!route.query.view,
  set: (value) => {
    if (!value) {
      showDetails.value = false;
      selectedMember.value = null;
      updateQueryParams({ view: null });
    }
  }
});

// Helper to sync view drawer from URL
const syncViewDrawer = () => {
  const viewId = route.query.view;
  if (viewId && members.value.length > 0) {
    const member = members.value.find(m => 
      String(m.id) === String(viewId) || 
      String(m.firestoreId) === String(viewId)
    );
    if (member) {
      selectedMember.value = member;
      showDetails.value = true;
    }
  } else if (!viewId) {
    showDetails.value = false;
    selectedMember.value = null;
  }
};

// Watch URL params to sync state on navigation
watch(() => route.query, (query) => {
  // Sync filter drawer
  if (query.filter === 'true') {
    activeDrawer.value = null;
    showAddMember.value = false;
  }
  
  // Sync add drawer
  if (query.add === 'true') {
    activeDrawer.value = null;
    showAddMember.value = true;
  } else {
    showAddMember.value = false;
  }
  
  // Sync view drawer
  syncViewDrawer();
}, { immediate: true });

// Also watch members loading - when members load, check if we need to show view panel
watch(() => members.value, () => {
  if (route.query.view) {
    syncViewDrawer();
  }
});

// Export handler
const handleExport = (config) => {
  exportToExcel(members.value, config);
  toast.success('Export downloaded successfully!');
};

// Member details handlers
const handleMemberClick = (member) => {
  const memberId = member.firestoreId || member.id;
  updateQueryParams({ view: memberId, filter: null, add: null });
};

// Context menu state
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  member: null,
});

const handleContextMenu = ({ member, x, y }) => {
  contextMenu.value = { show: true, x, y, member };
};

const closeContextMenu = () => {
  contextMenu.value.show = false;
};

// Context menu action handlers
const handleContextView = (member) => {
  const id = member?.firestoreId || member?.id;
  if (id) router.push(`/members/${id}`);
};

const handleContextEdit = (member) => {
  selectedMember.value = member;
  showDetails.value = true;
  showAddMember.value = false;
  activeDrawer.value = null;
  // Trigger edit mode in the drawer after it opens
  setTimeout(() => {
    const drawer = document.querySelector('.add-member-drawer');
    if (drawer) {
      const editBtn = drawer.querySelector('button[title="Edit"]');
      if (editBtn) editBtn.click();
    }
  }, 100);
};

const handleContextCall = (member) => {
  if (member?.contactNumber) {
    window.location.href = `tel:${member.contactNumber}`;
  }
};

const handleContextEmail = (member) => {
  if (member?.email) {
    window.location.href = `mailto:${member.email}`;
  }
};

const handleContextCopy = (member) => {
  const name = getFullName(member);
  navigator.clipboard.writeText(name);
};

// Confirmation modal state
const showConfirmation = ref(false);
const confirmationConfig = ref({
  title: 'Confirm Action',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  confirmButtonClass: 'bg-[#01779b] text-white hover:bg-[#015a77]',
  onConfirm: null
});

// Helper function to show confirmation modal
const showConfirmModal = (config) => {
  confirmationConfig.value = { ...confirmationConfig.value, ...config };
  showConfirmation.value = true;
};

const handleConfirmation = () => {
  if (confirmationConfig.value.onConfirm) {
    confirmationConfig.value.onConfirm();
  }
};

const handleMemberUpdate = async (updatedMemberData) => {
  try {
    // Remove id and firestoreId from update data (they shouldn't be updated)
    const { id, firestoreId, ...dataToUpdate } = updatedMemberData;
    await updateMemberInFirestore(selectedMember.value, dataToUpdate);
    toast.success('Changes saved');
    // Panel stays open for inline editing - don't close it
  } catch (error) {
    console.error('Error updating member:', error);
    toast.error('Failed to save changes. Please try again.');
  }
};

const handleMemberDelete = async (member) => {
  const getFullName = (m) => {
    return `${m.firstName || ''} ${m.lastName || ''}`.trim() || 'this member';
  };
  
  showConfirmModal({
    title: 'Delete Member',
    message: `Are you sure you want to delete ${getFullName(member)}? This action cannot be undone.`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    confirmButtonClass: 'bg-red-600 text-white hover:bg-red-700',
    onConfirm: async () => {
      try {
        await removeMember(member);
        showDetails.value = false;
        selectedMember.value = null;
        toast.success('Member deleted');
      } catch (error) {
        console.error('Error deleting member:', error);
        toast.error('Failed to delete member. Please try again.');
      }
    }
  });
};

// Computed property for selected member ID
const selectedMemberId = computed(() => {
  return selectedMember.value?.id || selectedMember.value?.firestoreId || null;
});

// Check if any drawer is open
const isDrawerOpen = computed(() => {
  return showFilters.value || showConfig.value || showAddMemberComputed.value || showDetailsComputed.value;
});
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Search Bar and View Controls -->
    <MembersToolbar
      v-model:searchQuery="searchQuery"
      v-model:viewMode="viewMode"
      v-model:layoutMode="layoutMode"
      v-model:showFilters="showFilters"
      v-model:showConfig="showConfig"
      v-model:showAddMember="showAddMemberComputed"
      :hasActiveFilters="hasActiveFilters"
      @export="showExport = true"
      @switchLayout="handleSwitchLayout"
    />

    <!-- Members List -->
    <div class="flex-1 overflow-hidden bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex">
      <!-- Members Content -->
      <div class="flex-1 h-full overflow-y-auto">
      <!-- Grid Layout -->
        <div v-if="layoutMode === 'grid'" :class="[
          'grid gap-3 p-3',
          isDrawerOpen ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
        ]">
          <template v-if="loading">
            <MemberCardSkeleton
              v-for="i in 12"
              :key="`skeleton-${i}`"
              :viewMode="viewMode"
            />
          </template>
          <MemberCard
            v-else
          v-for="member in filteredMembers"
          :key="member.id"
            :member="member"
            :viewMode="viewMode"
            :visibleFields="visibleFields"
            :selected="selectedMemberId === member.id || selectedMemberId === member.firestoreId"
            @click="handleMemberClick"
            @contextmenu="handleContextMenu"
          />
          </div>

      <!-- List Layout -->
      <div v-else class="space-y-1 p-2">
          <template v-if="loading">
            <div
              v-for="i in 10"
              :key="`skeleton-${i}`"
              class="p-4 flex items-center gap-4"
            >
              <div class="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-600 animate-pulse"></div>
              <div class="flex-1 space-y-2">
                <div class="h-4 w-32 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                <div class="h-3 w-24 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
              </div>
            </div>
          </template>
          <MemberListItem
            v-else
          v-for="member in filteredMembers"
          :key="member.id"
            :member="member"
            :viewMode="viewMode"
            :visibleFields="visibleFields"
            :selected="selectedMemberId === member.id || selectedMemberId === member.firestoreId"
            @click="handleMemberClick"
            @contextmenu="handleContextMenu"
          />
          </div>

        <div v-if="!loading && filteredMembers.length === 0" class="p-8 text-center text-gray-500 dark:text-gray-400">
        No members found matching your search.
      </div>
      </div>

      <!-- Filter Drawer -->
      <FilterDrawer
        v-model:showFilters="showFilters"
        :filters="filters"
        v-model:sortBy="sortBy"
        v-model:sortOrder="sortOrder"
        :allTags="allTags"
        :hasActiveFilters="hasActiveFilters"
        @applyFilters="handleApplyFilters"
        @clearFilters="handleClearFilters"
      />

      <!-- Config Drawer -->
      <ConfigDrawer
        v-model:showConfig="showConfig"
        :visibleFields="visibleFields"
        :viewMode="viewMode"
        @update:visibleFields="visibleFields = $event"
      />

      <!-- Add Member Drawer -->
      <AddMemberDrawer
        v-model:showAddMember="showAddMemberComputed"
        :newMember="newMember"
        :allTags="allTags"
        :canAddMember="canAddMember"
        :addMemberTooltip="addMemberTooltip"
        @update:newMember="newMember = $event"
        @addMember="addMember"
        @calculateAge="calculateAge"
      />

      <!-- Member Details Drawer -->
      <MemberDetailsDrawer
        v-model:showDetails="showDetailsComputed"
        :member="selectedMember"
        :allTags="allTags"
        :loading="loading"
        @update="handleMemberUpdate"
        @delete="handleMemberDelete"
      />

      <!-- Confirmation Modal -->
      <ConfirmationModal
        :show="showConfirmation"
        :title="confirmationConfig.title"
        :message="confirmationConfig.message"
        :confirm-text="confirmationConfig.confirmText"
        :cancel-text="confirmationConfig.cancelText"
        :confirm-button-class="confirmationConfig.confirmButtonClass"
        @update:show="showConfirmation = $event"
        @confirm="handleConfirmation"
        @cancel="showConfirmation = false"
      />

      <!-- Context Menu -->
      <MemberContextMenu
        :show="contextMenu.show"
        :x="contextMenu.x"
        :y="contextMenu.y"
        :member="contextMenu.member"
        @close="closeContextMenu"
        @view="handleContextView"
        @edit="handleContextEdit"
        @delete="handleMemberDelete"
        @call="handleContextCall"
        @email="handleContextEmail"
        @copy="handleContextCopy"
      />
    </div>

    <!-- Export Dialog -->
    <ExportDialog
      v-model:showExport="showExport"
      :members="members"
      :allTags="allTags"
      :currentSortBy="sortBy"
      :currentSortOrder="sortOrder"
      :currentFilters="filters"
      @export="handleExport"
    />
  </div>
</template>

<style scoped>
/* Drawer column animations */
.drawer-enter-active .filter-drawer,
.drawer-enter-active .config-drawer,
.drawer-enter-active .add-member-drawer {
  transition: max-width 0.3s ease-out, opacity 0.3s ease;
}

.drawer-leave-active .filter-drawer,
.drawer-leave-active .config-drawer,
.drawer-leave-active .add-member-drawer {
  transition: max-width 0.3s ease-out, opacity 0.3s ease;
}

.drawer-enter-from .filter-drawer,
.drawer-enter-from .config-drawer,
.drawer-enter-from .add-member-drawer {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
}

.drawer-leave-to .filter-drawer,
.drawer-leave-to .config-drawer,
.drawer-leave-to .add-member-drawer {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
}
</style>
