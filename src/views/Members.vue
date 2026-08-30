<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useMembers } from "../composables/useMembers";
import { useMediaQuery } from "../composables/useMediaQuery";
import { useMemberSearch } from "../composables/useMemberSearch";
import { useMemberSorting } from "../composables/useMemberSorting";
import { useMemberStats } from "../composables/useMemberStats";
import { useMemberForm } from "../composables/useMemberForm";
import { useToast } from "../composables/useToast";
import MembersToolbar from "../components/members/MembersToolbar.vue";
import MembersSummary from "../components/members/MembersSummary.vue";
import MembersFab from "../components/members/MembersFab.vue";
import AddMemberDrawer from "../components/members/AddMemberDrawer.vue";
import MemberDetailsDrawer from "../components/members/MemberDetailsDrawer.vue";
import MemberContextMenu from "../components/members/MemberContextMenu.vue";
import ExportDialog from "../components/members/ExportDialog.vue";
import MemberCard from "../components/members/MemberCard.vue";
import MemberListItem from "../components/members/MemberListItem.vue";
import MemberCardSkeleton from "../components/members/MemberCardSkeleton.vue";
import ConfirmationModal from "../components/common/ConfirmationModal.vue";
import { exportToExcel } from "../utils/exportUtils";
import { getFullName, mergeTagSources } from "../utils/memberUtils";
import { subscribeToCustomTags } from "../api/tagsService";

const toast = useToast();

const router = useRouter();
const route = useRoute();
const isMobile = useMediaQuery("(max-width: 1023px)");

const searchQuery = ref("");

// Member data management
const { members, loading, addMemberToFirestore, updateMemberInFirestore, removeMember } = useMembers();

// Search is the only way the list is narrowed - it matches tags, sex, civil
// status, occupation and address as well as names.
const { allTags, filteredMembers: searchedMembers } = useMemberSearch(members, searchQuery);

// Custom tags created from the toolbar's "Add tag" control, registered as
// selectable options without being applied to any member yet.
const customTags = ref([]);
let unsubscribeCustomTags = null;

onMounted(() => {
  unsubscribeCustomTags = subscribeToCustomTags((tags) => {
    customTags.value = tags.map((t) => t.name);
  });
});

onUnmounted(() => {
  if (unsubscribeCustomTags) unsubscribeCustomTags();
});

// Tags offered when assigning/editing a member's tags: existing tags plus
// ready-to-pick presets and toolbar-created tags, even before anyone has
// been tagged with them.
const assignableTags = computed(() => mergeTagSources(allTags.value, customTags.value));

// Sorting
const { sortBy, sortOrder, sortMembers } = useMemberSorting();

// Apply sorting to the searched members
const filteredMembers = computed(() => {
  return sortMembers(searchedMembers.value);
});

// At-a-glance report. Scoped to what is on screen, so searching "youth"
// reports on the youth rather than on everyone.
const { stats, agedTotal, birthdayMonthLabel } = useMemberStats(filteredMembers);

const showExport = ref(false);
const selectedMember = ref(null);
const showDetails = ref(false);

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

// Computed property for showAddMember to work with v-model and URL params
const showAddMemberComputed = computed({
  get: () => route.query.add === 'true',
  set: (value) => {
    if (value) {
      showDetails.value = false;
      selectedMember.value = null;
      showAddMember.value = true;
      updateQueryParams({ add: 'true', view: null });
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
  // Sync add drawer
  if (query.add === 'true') {
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

// Add member handler - the drawer is driven by the `add` query param, so a
// successful save has to close it there (not via the form's own ref).
const handleAddMember = async () => {
  const added = await addMember();
  if (added) {
    showAddMemberComputed.value = false;
  }
};

// Export handler - `onlyVisible` exports exactly what the search is showing.
const handleExport = (config) => {
  exportToExcel(config.onlyVisible ? filteredMembers.value : members.value, config);
  toast.success('Export downloaded successfully!');
};

// Member details handlers
const handleMemberClick = (member) => {
  const memberId = member.firestoreId || member.id;
  updateQueryParams({ view: memberId, add: null });
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
  // Same as handleMemberClick: the drawer opens off the `view` query param
  updateQueryParams({ view: member?.firestoreId || member?.id, add: null });
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
        // Details drawer is driven by the `view` query param - clearing it
        // also resets showDetails/selectedMember via the computed setter.
        showDetailsComputed.value = false;
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

// Check if any side drawer is open (member details uses modal on mobile)
const isDrawerOpen = computed(() => {
  const memberDetailsOpen = showDetailsComputed.value && !isMobile.value;
  return showAddMemberComputed.value || memberDetailsOpen;
});

// The button would sit on top of whatever a drawer or the details modal is
// showing, and both carry their own actions anyway.
const showFab = computed(() => !showAddMemberComputed.value && !showDetailsComputed.value);
</script>

<template>
  <div class="relative flex flex-col h-full">
    <!-- Search, export and add -->
    <MembersToolbar
      v-model:searchQuery="searchQuery"
      :resultCount="filteredMembers.length"
      :totalCount="members.length"
    />

    <!-- Members List -->
    <div class="flex-1 overflow-hidden bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex">
      <!-- Members Content -->
      <div class="flex-1 min-w-0 h-full overflow-y-auto pb-20">
        <MembersSummary
          :stats="stats"
          :agedTotal="agedTotal"
          :birthdayMonthLabel="birthdayMonthLabel"
          :loading="loading"
        />

      <!-- Grid on desktop, list on mobile - the viewport decides, not a toggle -->
        <div v-if="!isMobile" :class="[
          'grid gap-3 p-3',
          isDrawerOpen ? 'grid-cols-2' : 'grid-cols-4'
        ]">
          <template v-if="loading">
            <MemberCardSkeleton v-for="i in 12" :key="`skeleton-${i}`" />
          </template>
          <MemberCard
            v-else
          v-for="member in filteredMembers"
          :key="member.id"
            :member="member"
            :selected="selectedMemberId === member.id || selectedMemberId === member.firestoreId"
            @click="handleMemberClick"
            @contextmenu="handleContextMenu"
          />
          </div>

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
            :selected="selectedMemberId === member.id || selectedMemberId === member.firestoreId"
            @click="handleMemberClick"
            @contextmenu="handleContextMenu"
          />
          </div>

        <div v-if="!loading && filteredMembers.length === 0" class="p-8 text-center text-gray-500 dark:text-gray-400">
        No members found matching your search.
      </div>
      </div>

      <!-- Add Member Drawer -->
      <AddMemberDrawer
        v-model:showAddMember="showAddMemberComputed"
        :newMember="newMember"
        :allTags="assignableTags"
        :canAddMember="canAddMember"
        :addMemberTooltip="addMemberTooltip"
        @update:newMember="newMember = $event"
        @addMember="handleAddMember"
        @calculateAge="calculateAge"
      />

      <!-- Member Details Drawer -->
      <MemberDetailsDrawer
        v-model:showDetails="showDetailsComputed"
        :member="selectedMember"
        :allTags="assignableTags"
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

    <!-- Floating actions -->
    <MembersFab
      v-if="showFab"
      @add="showAddMemberComputed = true"
      @export="showExport = true"
    />

    <!-- Export Dialog -->
    <ExportDialog
      v-model:showExport="showExport"
      :members="members"
      :visibleCount="filteredMembers.length"
      :currentSortBy="sortBy"
      :currentSortOrder="sortOrder"
      @export="handleExport"
    />
  </div>
</template>

<style scoped>
/* Drawer column animations */
.drawer-enter-active .add-member-drawer,
.drawer-leave-active .add-member-drawer {
  transition: max-width 0.3s ease-out, opacity 0.3s ease;
}

.drawer-enter-from .add-member-drawer,
.drawer-leave-to .add-member-drawer {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
}
</style>
