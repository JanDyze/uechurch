<script setup>
import { ref, computed } from "vue";
import { useMembers } from "../composables/useMembers";
import { useMemberFilters } from "../composables/useMemberFilters";
import { useMemberSorting } from "../composables/useMemberSorting";
import { useFamilyGroups } from "../composables/useFamilyGroups";
import { useMemberForm } from "../composables/useMemberForm";
import MembersToolbar from "../components/members/MembersToolbar.vue";
import FilterDrawer from "../components/members/FilterDrawer.vue";
import ConfigDrawer from "../components/members/ConfigDrawer.vue";
import AddMemberDrawer from "../components/members/AddMemberDrawer.vue";
import MemberDetailsDrawer from "../components/members/MemberDetailsDrawer.vue";
import ExportDialog from "../components/members/ExportDialog.vue";
import FamilyGroup from "../components/members/FamilyGroup.vue";
import MemberCard from "../components/members/MemberCard.vue";
import MemberListItem from "../components/members/MemberListItem.vue";
import MemberCardSkeleton from "../components/members/MemberCardSkeleton.vue";
import ConfirmationModal from "../components/common/ConfirmationModal.vue";
import { exportToCSV } from "../utils/exportUtils";

const searchQuery = ref("");

// Member data management
const { members, loading, addMemberToFirestore, updateMemberInFirestore, removeMember } = useMembers();

// Filters
const { filters, allTags, filteredMembers: baseFilteredMembers, hasActiveFilters, clearFilters, toggleTag } = useMemberFilters(members, searchQuery);

// Sorting
const { sortBy, sortOrder, familyMemberSort, sortMembers, sortFamilyMembers } = useMemberSorting();

// Apply sorting to filtered members
const filteredMembers = computed(() => {
  return sortMembers(baseFilteredMembers.value);
});

// Family groups
const groupByFamily = ref(false);
const { familyGroups } = useFamilyGroups(
  members,
  filteredMembers,
  groupByFamily,
  sortFamilyMembers,
  sortMembers,
  sortBy,
  sortOrder
);

// View state
const viewMode = ref("simple");
const layoutMode = ref("grid");
const activeDrawer = ref(null);
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

// Computed properties for drawer visibility
const showFilters = computed({
  get: () => activeDrawer.value === 'filter',
  set: (value) => {
    if (value) {
      showAddMember.value = false;
      activeDrawer.value = 'filter';
    } else {
      activeDrawer.value = null;
      showAddMember.value = false;
    }
  }
});

const showConfig = computed({
  get: () => activeDrawer.value === 'config',
  set: (value) => {
    if (value) {
      // Opening config drawer - close other drawers
      showAddMember.value = false;
      activeDrawer.value = 'config';
    } else {
      // Closing config drawer
      activeDrawer.value = null;
      showAddMember.value = false;
    }
  }
});

// Computed property for showAddMember to work with v-model
const showAddMemberComputed = computed({
  get: () => showAddMember.value,
  set: (value) => {
    if (value) {
      activeDrawer.value = null;
      showAddMember.value = true;
  } else {
      showAddMember.value = false;
    }
  }
});

// Export handler
const handleExport = (config) => {
  exportToCSV(members.value, config);
};

// Member details handlers
const handleMemberClick = (member) => {
  selectedMember.value = member;
  showDetails.value = true;
  // Close other drawers
  showAddMember.value = false;
  activeDrawer.value = null;
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
    showDetails.value = false;
    selectedMember.value = null;
  } catch (error) {
    console.error('Error updating member:', error);
    showConfirmModal({
      title: 'Error',
      message: 'Failed to update member. Please try again.',
      confirmText: 'OK',
      cancelText: '',
      onConfirm: () => {},
    });
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
      } catch (error) {
        console.error('Error deleting member:', error);
        showConfirmModal({
          title: 'Error',
          message: 'Failed to delete member. Please try again.',
          confirmText: 'OK',
          cancelText: '',
          onConfirm: () => {},
        });
      }
    }
  });
};

// Computed property for showDetails drawer
const showDetailsComputed = computed({
  get: () => showDetails.value,
  set: (value) => {
    showDetails.value = value;
    if (!value) {
      selectedMember.value = null;
    }
  }
});

// Computed property for selected member ID
const selectedMemberId = computed(() => {
  return selectedMember.value?.id || selectedMember.value?.firestoreId || null;
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
    />

    <!-- Members List -->
    <div class="flex-1 overflow-hidden bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex">
      <!-- Members Content -->
      <div class="flex-1 h-full overflow-y-auto">
      <!-- Family Grouped Layout -->
      <div v-if="groupByFamily" class="p-4 space-y-4">
          <FamilyGroup
          v-for="family in familyGroups"
          :key="family.id"
            :family="family"
            :layoutMode="layoutMode"
            :viewMode="viewMode"
            :visibleFields="visibleFields"
            :selectedMemberId="selectedMemberId"
            @memberClick="handleMemberClick"
          />
        <div v-if="familyGroups.length === 0" class="p-8 text-center text-gray-500 dark:text-gray-400">
          No family groups found.
        </div>
      </div>

      <!-- Grid Layout -->
        <div v-else-if="!groupByFamily && layoutMode === 'grid'" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-3">
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
          />
          </div>

      <!-- List Layout -->
      <div v-else-if="!groupByFamily" class="divide-y divide-gray-200 dark:divide-gray-700">
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
        v-model:groupByFamily="groupByFamily"
        :allTags="allTags"
        :hasActiveFilters="hasActiveFilters"
        @clearFilters="clearFilters"
        @toggleTag="toggleTag"
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
