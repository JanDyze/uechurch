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
import MemberBandHeader from "../components/members/MemberBandHeader.vue";
import ConfirmationModal from "../components/common/ConfirmationModal.vue";
import BulkAssignSheet from "../components/members/BulkAssignSheet.vue";
import { exportToExcel } from "../utils/exportUtils";
import { getFullName, mergeTagSources } from "../utils/memberUtils";
import { usePermissions } from "../composables/usePermissions";
import { useMinistries } from "../composables/useMinistries";
import { areaLabel } from "../data/capabilities";
import { groupByBand } from "../utils/ageBands";
import { Tag, X, Church } from "../icons";
import {
  subscribeToCustomTags,
  addCustomTag,
  addTagToMembers,
  removeTagFromMembers,
} from "../api/tagsService";
import {
  addMinistryToMembers,
  removeMinistryFromMembers,
} from "../api/ministriesService";

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

// The list is divided the way the summary bar above it already counts, and the
// way the attendance recorder checks people off: kids, youth, adults, seniors,
// then whoever has no age on record. Sorting still applies — it just applies
// inside a band, which is where "who is missing" is actually asked.
const memberGroups = computed(() => groupByBand(filteredMembers.value));

/* ------------------------------------------------------------ bulk tagging */
// A tag is picked one person at a time in the details drawer, which is fine for
// one person and hopeless for thirty — and thirty is the normal case, because a
// tag is what an event now counts its expected attendance from.
//
// Two ways in, both landing on the same sheet and the same batched write:
// tag everyone the search is showing, or pick names off the list by hand.
//
// The same selection also assigns ministries — but a ministry grants access
// and a tag grants nothing, so the two are not offered on equal terms. Tagging
// is one tap from the search bar; a ministry can only be applied to a
// selection someone picked deliberately, and states what it hands out first.
const { canManage, roleMap } = usePermissions();
const { ministryNames } = useMinistries();
const canTag = computed(() => canManage("members"));

const picking = ref(false);
// Ids, not member records: the list is live, and holding copies would write
// against a stale version of someone edited elsewhere mid-selection.
const pickedIds = ref(new Set());
const tagTargetIds = ref(new Set());
/** null, or which sheet is open: 'tags' | 'ministries'. */
const sheet = ref(null);
const tagging = ref(false);

// What joining one actually hands out, in the words Settings uses. Read from
// the same roleMap that resolves permissions, so the sheet cannot promise
// something the app would not honour.
const ministryOptions = computed(() =>
  ministryNames.value.map((name) => {
    const areas = [
      ...new Set((roleMap.value[name] || []).map((cap) => areaLabel(cap.split(".")[0]))),
    ];
    return {
      name,
      hint: areas.length ? `Grants ${areas.join(", ")}` : "Grants nothing on its own yet",
    };
  })
);

const sheetConfig = computed(() => {
  const count = tagTargets.value.length;
  const people = `${count} ${count === 1 ? "person" : "people"}`;
  if (sheet.value === "ministries") {
    return {
      field: "ministries",
      icon: Church,
      title: `Ministry for ${people}`,
      hint: "Tap to put everyone in, again to take them out",
      note: "A ministry grants access. Everyone added can do what the role allows.",
      options: ministryOptions.value,
      allowCreate: false,
      emptyText: "No ministries yet — add them in Settings > Ministries.",
    };
  }
  return {
    field: "tags",
    icon: Tag,
    title: `Tag ${people}`,
    hint: "Tap a tag to add it to everyone, again to take it off",
    note: "",
    options: assignableTags.value,
    allowCreate: true,
    emptyText: `No tags yet. Type one above and it lands on all ${count} of them at once.`,
  };
});

const memberId = (member) => String(member.firestoreId || member.id);
const pickedCount = computed(() => pickedIds.value.size);

// Resolved from the live list every time, so the sheet's "8 of 34" recounts
// itself the moment a batch lands.
const tagTargets = computed(() =>
  members.value.filter((m) => tagTargetIds.value.has(memberId(m)))
);

// The Set is replaced rather than mutated: a mutation in place is not what the
// rows are watching, and half of them would keep their old tick.
const togglePicked = (member) => {
  const id = memberId(member);
  const next = new Set(pickedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  pickedIds.value = next;
};

const startPicking = (member) => {
  if (!canTag.value) return;
  picking.value = true;
  pickedIds.value = member ? new Set([memberId(member)]) : new Set();
};

const stopPicking = () => {
  picking.value = false;
  pickedIds.value = new Set();
};

/** "Select all" means what is on screen — which is whatever the search left. */
const pickAllVisible = () => {
  pickedIds.value = new Set(filteredMembers.value.map(memberId));
};

// Whole-band selection, off the band's own heading. Tagging an age group is
// the common bulk edit — the kids become WLA Kids — and picking forty names by
// hand to do it is the thing the headings are there to save.
const isBandPicked = (group) =>
  group.members.length > 0 && group.members.every((m) => pickedIds.value.has(memberId(m)));

const toggleBand = (group) => {
  const next = new Set(pickedIds.value);
  const drop = isBandPicked(group);
  group.members.forEach((member) => {
    const id = memberId(member);
    if (drop) next.delete(id);
    else next.add(id);
  });
  pickedIds.value = next;
};

const openSheetForPicked = (kind) => {
  if (!pickedIds.value.size) return;
  tagTargetIds.value = new Set(pickedIds.value);
  sheet.value = kind;
};

/** Straight from the toolbar: the search narrowed the list, so it is the group.
 *  Tags only — see the note above on why a ministry never starts here. */
const openTagSheetForResults = () => {
  if (!canTag.value || !filteredMembers.value.length) return;
  tagTargetIds.value = new Set(filteredMembers.value.map(memberId));
  sheet.value = "tags";
};

/** How many of the selection the write would actually touch. */
const countChanging = (field, name, mode) =>
  tagTargets.value.filter((member) => {
    const held = (member[field] || []).some(
      (value) => String(value).toLowerCase() === name.toLowerCase()
    );
    return mode === "remove" ? held : !held;
  }).length;

// A ministry is the field that hands out access, so a batch of them is
// confirmed with the number and the grant spelled out. Tags need no such
// ceremony: they grant nothing, and a wrong one is one tap to undo.
const confirmMinistry = ({ value, mode }) => {
  const count = countChanging("ministries", value, mode);
  if (!count) {
    toast.success(
      mode === "remove"
        ? `Nobody selected was in "${value}"`
        : `Everyone selected was already in "${value}"`
    );
    return;
  }

  const people = `${count} ${count === 1 ? "person" : "people"}`;
  const grants = ministryOptions.value.find((o) => o.name === value)?.hint || "";

  showConfirmModal({
    title: mode === "remove" ? "Remove from ministry" : "Add to ministry",
    message:
      mode === "remove"
        ? `Take ${people} out of "${value}"? They lose whatever access it granted them.`
        : `Put ${people} into "${value}"? A ministry grants access — ${grants.toLowerCase()}.`,
    confirmText: mode === "remove" ? "Remove" : "Add",
    cancelText: "Cancel",
    confirmButtonClass:
      mode === "remove"
        ? "bg-red-600 text-white hover:bg-red-700"
        : "bg-primary text-white hover:bg-primary-hover",
    onConfirm: () => {
      showConfirmation.value = false;
      applyBulk({ value, mode });
    },
  });
};

const handleSheetApply = (payload) => {
  if (sheet.value === "ministries") {
    confirmMinistry(payload);
    return;
  }
  applyBulk(payload);
};

const applyBulk = async ({ value, mode, register }) => {
  const targets = tagTargets.value;
  const kind = sheet.value;
  if (!targets.length || tagging.value || !kind) return;

  tagging.value = true;
  try {
    // A tag typed into the sheet is registered as well as applied, so it turns
    // up in Settings and in every picker instead of only on these people. A
    // ministry can never arrive this way — the sheet offers no input for one.
    if (register && kind === "tags") await addCustomTag(value);

    const changed =
      kind === "ministries"
        ? mode === "remove"
          ? await removeMinistryFromMembers(targets, value)
          : await addMinistryToMembers(targets, value)
        : mode === "remove"
          ? await removeTagFromMembers(targets, value)
          : await addTagToMembers(targets, value);

    if (!changed) {
      toast.success(
        mode === "remove"
          ? `Nobody selected had "${value}"`
          : `Everyone selected already had "${value}"`
      );
    } else {
      const people = `${changed} ${changed === 1 ? "person" : "people"}`;
      toast.success(
        mode === "remove" ? `"${value}" removed from ${people}` : `"${value}" added to ${people}`
      );
    }
  } catch (error) {
    console.error("Error applying a change to several members:", error);
    toast.error(error?.message || "Could not apply that. Please try again.");
  } finally {
    tagging.value = false;
  }
};

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
// While picking, the action bar owns the bottom of the screen.
const showFab = computed(
  () => !showAddMemberComputed.value && !showDetailsComputed.value && !picking.value
);
</script>

<template>
  <div class="relative flex flex-col h-full">
    <!-- Search, export and add -->
    <MembersToolbar
      v-model:searchQuery="searchQuery"
      :resultCount="filteredMembers.length"
      :totalCount="members.length"
      :canTag="canTag"
      @tag-results="openTagSheetForResults"
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

      <!-- Grid on desktop, list on mobile - the viewport decides, not a toggle.
           Both are divided into age bands, each heading carrying its own count
           so "we are short on youth" reads without counting rows. -->
        <template v-if="!isMobile">
          <div
            v-if="loading"
            :class="['grid gap-3 p-3', isDrawerOpen ? 'grid-cols-2' : 'grid-cols-4']"
          >
            <MemberCardSkeleton v-for="i in 12" :key="`skeleton-${i}`" />
          </div>

          <section v-else v-for="group in memberGroups" :key="group.band.key">
            <MemberBandHeader
              :band="group.band"
              :count="group.members.length"
              :picking="picking"
              :checked="isBandPicked(group)"
              @toggle="toggleBand(group)"
            />
            <div
              :class="['grid gap-3 p-3', isDrawerOpen ? 'grid-cols-2' : 'grid-cols-4']"
            >
              <MemberCard
                v-for="member in group.members"
                :key="member.id"
                :member="member"
                :selected="selectedMemberId === member.id || selectedMemberId === member.firestoreId"
                :picking="picking"
                :checked="pickedIds.has(String(member.firestoreId || member.id))"
                @click="handleMemberClick"
                @contextmenu="handleContextMenu"
                @toggle="togglePicked"
              />
            </div>
          </section>
        </template>

        <template v-else>
          <div v-if="loading" class="space-y-1 p-2">
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
          </div>

          <section v-else v-for="group in memberGroups" :key="group.band.key">
            <MemberBandHeader
              :band="group.band"
              :count="group.members.length"
              :picking="picking"
              :checked="isBandPicked(group)"
              @toggle="toggleBand(group)"
            />
            <div class="space-y-1 p-2">
              <MemberListItem
                v-for="member in group.members"
                :key="member.id"
                :member="member"
                :selected="selectedMemberId === member.id || selectedMemberId === member.firestoreId"
                :picking="picking"
                :checked="pickedIds.has(String(member.firestoreId || member.id))"
                @click="handleMemberClick"
                @contextmenu="handleContextMenu"
                @toggle="togglePicked"
              />
            </div>
          </section>
        </template>

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
        @select="startPicking"
      />
    </div>

    <!-- Picking mode. One bar for the whole selection, sitting where the FAB
         would be so the thumb does not have to travel. -->
    <div
      v-if="picking"
      class="absolute inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 px-3 py-3 backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-gray-700 dark:bg-gray-900/95"
    >
      <div class="flex items-center gap-3">
        <button
          @click="stopPicking"
          aria-label="Cancel selection"
          class="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <X class="h-5 w-5" />
        </button>

        <!-- Truncating keeps the bar one row deep on a narrow phone, where two
             actions and a count are already all it can hold. -->
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {{ pickedCount }} selected
          </p>
          <button
            @click="pickAllVisible"
            class="block max-w-full truncate text-xs font-medium text-primary dark:text-primary-light"
          >
            Select all {{ filteredMembers.length }}
          </button>
        </div>

        <!-- Ministry sits beside Tag rather than inside its sheet: they write
             different fields and only one of them grants access. -->
        <button
          @click="openSheetForPicked('ministries')"
          :disabled="!pickedCount"
          :class="[
            'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors',
            pickedCount
              ? 'border border-primary/40 text-primary hover:bg-primary/10 dark:text-primary-light'
              : 'cursor-not-allowed border border-gray-200 text-gray-400 dark:border-gray-700',
          ]"
        >
          <Church class="h-4 w-4" />
          Ministry
        </button>

        <button
          @click="openSheetForPicked('tags')"
          :disabled="!pickedCount"
          :class="[
            'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-colors',
            pickedCount
              ? 'bg-primary text-white shadow-lg shadow-primary/25 hover:bg-primary-hover'
              : 'cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-700',
          ]"
        >
          <Tag class="h-4 w-4" />
          Tag
        </button>
      </div>
    </div>

    <!-- Floating actions -->
    <MembersFab
      v-if="showFab"
      @add="showAddMemberComputed = true"
      @export="showExport = true"
    />

    <BulkAssignSheet
      :show="!!sheet"
      :members="tagTargets"
      :field="sheetConfig.field"
      :options="sheetConfig.options"
      :title="sheetConfig.title"
      :hint="sheetConfig.hint"
      :note="sheetConfig.note"
      :icon="sheetConfig.icon"
      :allow-create="sheetConfig.allowCreate"
      :empty-text="sheetConfig.emptyText"
      create-placeholder="New tag, e.g. Choir"
      :busy="tagging"
      @close="sheet = null"
      @apply="handleSheetApply"
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
