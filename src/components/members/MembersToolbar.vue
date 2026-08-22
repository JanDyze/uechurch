<script setup>
import { computed, ref } from "vue";
import {
  Grid3x3,
  LayoutGrid,
  List,
  ListTodo,
  Plus,
  Filter,
  Download,
  Search,
  X,
  ChevronRight,
  Settings2,
} from "lucide-vue-next";
import SearchBar from "../common/SearchBar.vue";
import { useFocusTrap } from "../../composables/useFocusTrap";

const showViewOptions = ref(false);

const viewOptionsRef = ref(null);
const closeViewOptions = () => {
  showViewOptions.value = false;
};
useFocusTrap(viewOptionsRef, showViewOptions, closeViewOptions);

const props = defineProps({
  searchQuery: {
    type: String,
    default: "",
  },
  viewMode: {
    type: String,
    default: "simple",
  },
  layoutMode: {
    type: String,
    default: "grid",
  },
  showFilters: {
    type: Boolean,
    default: false,
  },
  showAddMember: {
    type: Boolean,
    default: false,
  },
  hasActiveFilters: {
    type: Boolean,
    default: false,
  },
  filters: {
    type: Object,
    default: () => ({}),
  },
  resultCount: {
    type: Number,
    default: 0,
  },
  totalCount: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits([
  "update:searchQuery",
  "update:viewMode",
  "update:layoutMode",
  "update:showFilters",
  "update:showAddMember",
  "export",
  "switchLayout",
  "removeFilter",
  "clearFilters",
]);

const gridIcon = computed(() => {
  return props.layoutMode === "grid" && props.viewMode === "detailed"
    ? LayoutGrid
    : Grid3x3;
});

const listIcon = computed(() => {
  return props.layoutMode === "list" && props.viewMode === "detailed"
    ? ListTodo
    : List;
});

const handleViewModeToggle = () => {
  if (props.layoutMode === "grid") {
    // Already in grid, toggle between simple/detailed
    emit("update:viewMode", props.viewMode === "simple" ? "detailed" : "simple");
  } else {
    // Switch to grid mode
    emit("switchLayout", { layout: "grid", viewMode: "simple" });
  }
};

const handleListModeToggle = () => {
  if (props.layoutMode === "list") {
    // Already in list, toggle between simple/detailed
    emit("update:viewMode", props.viewMode === "simple" ? "detailed" : "simple");
  } else {
    // Switch to list mode
    emit("switchLayout", { layout: "list", viewMode: "simple" });
  }
};

/* ---------- Mobile: active filter summary ---------- */

// One chip per active filter so the applied state is visible without
// re-opening the filter sheet.
const activeFilterChips = computed(() => {
  const f = props.filters || {};
  const chips = [];

  (f.tags || []).forEach((tag) => {
    chips.push({ id: `tag-${tag}`, label: tag, key: "tags", value: tag });
  });
  if (f.isMember !== null && f.isMember !== undefined) {
    chips.push({
      id: "isMember",
      label: f.isMember ? "Members" : "Non-members",
      key: "isMember",
    });
  }
  if (f.sex) {
    chips.push({ id: "sex", label: f.sex, key: "sex" });
  }
  if (f.civilStatus) {
    chips.push({ id: "civilStatus", label: f.civilStatus, key: "civilStatus" });
  }
  if (f.hasAddress !== null && f.hasAddress !== undefined) {
    chips.push({
      id: "hasAddress",
      label: f.hasAddress ? "Has address" : "No address",
      key: "hasAddress",
    });
  }
  if (f.hasOccupation !== null && f.hasOccupation !== undefined) {
    chips.push({
      id: "hasOccupation",
      label: f.hasOccupation ? "Has job" : "No job",
      key: "hasOccupation",
    });
  }

  return chips;
});

const activeFilterCount = computed(() => activeFilterChips.value.length);

// The count/chips strip only earns its vertical space while something is narrowing the list
const showSummary = computed(
  () => !!props.searchQuery || activeFilterCount.value > 0
);

/* ---------- Mobile: view options sheet ---------- */

const openFilters = () => {
  showViewOptions.value = false;
  emit("update:showFilters", !props.showFilters);
};

const openAddMember = () => {
  showViewOptions.value = false;
  emit("update:showFilters", false);
  emit("update:showAddMember", !props.showAddMember);
};

// Keep the current density when switching layout so the sheet never
// silently resets what the user picked.
const selectLayout = (layout) => {
  if (layout === props.layoutMode) return;
  emit("switchLayout", { layout, viewMode: props.viewMode });
};

const selectViewMode = (mode) => {
  if (mode === props.viewMode) return;
  emit("update:viewMode", mode);
};

const handleExport = () => {
  showViewOptions.value = false;
  emit("export");
};
</script>

<template>
  <div
    class="sticky top-0 z-40 mb-3 shrink-0 rounded-xl border border-gray-200/80 bg-white/95 px-2 py-2 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 sm:px-3 lg:mb-4"
  >
    <!-- ==================== Mobile ==================== -->
    <div class="flex items-center gap-1.5 lg:hidden">
      <!-- Always-visible search: it is the primary action on this page -->
      <div class="relative min-w-0 flex-1">
        <Search
          class="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-gray-400"
        />
        <input
          :value="searchQuery"
          @input="emit('update:searchQuery', $event.target.value)"
          type="text"
          inputmode="search"
          enterkeyhint="search"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          aria-label="Search members"
          placeholder="Search members..."
          class="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9.5 pr-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:bg-gray-800"
        />
        <button
          v-if="searchQuery"
          @click="emit('update:searchQuery', '')"
          class="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 active:bg-gray-100 dark:active:bg-gray-700"
          aria-label="Clear search"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <!-- Filters -->
      <button
        @click="openFilters"
        :class="[
          'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform active:scale-95',
          showFilters || hasActiveFilters
            ? 'bg-primary text-white shadow-sm'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
        ]"
        :aria-label="`Filter members${activeFilterCount ? `, ${activeFilterCount} active` : ''}`"
        :aria-pressed="showFilters"
      >
        <Filter class="h-5 w-5" />
        <span
          v-if="activeFilterCount"
          class="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[#bc1c09] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-gray-900"
        >
          {{ activeFilterCount > 9 ? "9+" : activeFilterCount }}
        </span>
      </button>

      <!-- View options (layout, density, export) -->
      <button
        @click="showViewOptions = true"
        :class="[
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform active:scale-95',
          showViewOptions
            ? 'bg-primary text-white shadow-sm'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
        ]"
        aria-label="View options"
      >
        <Settings2 class="h-5 w-5" />
      </button>

      <!-- Add member -->
      <button
        @click="openAddMember"
        class="flex h-11 shrink-0 items-center justify-center gap-1 rounded-xl bg-primary px-2.5 text-white shadow-sm transition-transform active:scale-95"
        :aria-label="showAddMember ? 'Close add member form' : 'Add new member'"
      >
        <Plus
          class="h-5 w-5 shrink-0 transition-transform duration-300 ease-in-out"
          :class="{ 'rotate-45': showAddMember }"
        />
        <span class="text-sm font-medium">Add</span>
      </button>
    </div>

    <!-- Result count + active filter chips (mobile) -->
    <div v-if="showSummary" class="mt-2 flex items-center gap-2 lg:hidden">
      <span
        class="shrink-0 text-[11px] font-semibold tabular-nums text-gray-500 dark:text-gray-400"
      >
        {{ resultCount }} of {{ totalCount }}
      </span>

      <div
        v-if="activeFilterCount"
        class="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-0.5"
      >
        <button
          v-for="chip in activeFilterChips"
          :key="chip.id"
          @click="emit('removeFilter', { key: chip.key, value: chip.value })"
          class="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 py-1 pl-2.5 pr-1.5 text-[11px] font-medium text-primary transition-transform active:scale-95 dark:bg-primary/20 dark:text-primary-light"
          :aria-label="`Remove filter ${chip.label}`"
        >
          {{ chip.label }}
          <X class="h-3 w-3" />
        </button>
      </div>
      <div v-else class="flex-1"></div>

      <button
        v-if="activeFilterCount"
        @click="emit('clearFilters')"
        class="shrink-0 rounded-lg px-1.5 py-1 text-[11px] font-semibold text-gray-500 active:bg-gray-100 dark:text-gray-400 dark:active:bg-gray-700"
      >
        Clear all
      </button>
    </div>

    <!-- ==================== Desktop ==================== -->
    <div class="hidden w-full items-center justify-between gap-2 lg:flex">
      <SearchBar
        :model-value="searchQuery"
        @update:model-value="emit('update:searchQuery', $event)"
        placeholder="Search members..."
      />

      <div class="ml-auto flex shrink-0 flex-nowrap items-center gap-2">
        <!-- Filter Button -->
        <button
          @click="emit('update:showFilters', !showFilters)"
          :class="[
            'relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
            showFilters || hasActiveFilters
              ? 'bg-primary text-white shadow-sm dark:bg-primary'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
          ]"
          title="Filter members"
        >
          <Filter class="h-5 w-5" />
          <span
            v-if="hasActiveFilters"
            class="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#bc1c09]"
          ></span>
        </button>

        <!-- View Mode Controls -->
        <div
          class="flex shrink-0 items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700"
        >
          <button
            @click="handleViewModeToggle"
            :class="[
              'rounded p-1.5 transition-colors',
              props.layoutMode === 'grid'
                ? 'bg-white text-primary shadow-sm dark:bg-gray-600 dark:text-primary'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white',
            ]"
            :title="
              props.layoutMode === 'grid'
                ? props.viewMode === 'simple'
                  ? 'Switch to Detailed Grid'
                  : 'Switch to Simple Grid'
                : 'Grid View'
            "
          >
            <component :is="gridIcon" class="h-5 w-5" />
          </button>
          <button
            @click="handleListModeToggle"
            :class="[
              'rounded p-1.5 transition-colors',
              props.layoutMode === 'list'
                ? 'bg-white text-primary shadow-sm dark:bg-gray-600 dark:text-primary'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white',
            ]"
            :title="
              props.layoutMode === 'list'
                ? props.viewMode === 'simple'
                  ? 'Switch to Detailed List'
                  : 'Switch to Simple List'
                : 'List View'
            "
          >
            <component :is="listIcon" class="h-5 w-5" />
          </button>
        </div>

        <!-- Export Button -->
        <button
          @click="emit('export')"
          class="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-gray-100 px-4 text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          title="Export to Google Sheets"
        >
          <Download class="h-5 w-5 shrink-0" />
          <span class="whitespace-nowrap text-sm">Export</span>
        </button>

        <!-- Add Member Button -->
        <button
          @click="
            emit('update:showFilters', false);
            emit('update:showAddMember', !showAddMember);
          "
          class="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-white shadow-sm transition-colors hover:bg-primary-hover dark:bg-primary dark:hover:bg-primary-hover"
          :title="showAddMember ? 'Close add member form' : 'Add new member'"
        >
          <Plus
            class="h-5 w-5 shrink-0 transition-transform duration-300 ease-in-out"
            :class="{ 'rotate-45': showAddMember }"
          />
          <span class="whitespace-nowrap text-sm">Add</span>
        </button>
      </div>
    </div>
  </div>

  <!-- ==================== Mobile view options sheet ==================== -->
  <Teleport to="body">
    <Transition name="sheet">
      <div
        v-if="showViewOptions"
        class="fixed inset-0 z-80 flex flex-col justify-end lg:hidden"
      >
        <div class="absolute inset-0 bg-black/50" @click="showViewOptions = false" />

        <div
          ref="viewOptionsRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="view-options-sheet-title"
          tabindex="-1"
          class="sheet-panel relative z-10 w-full rounded-t-2xl border-t border-gray-200 bg-white pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl dark:border-gray-700 dark:bg-gray-800"
        >
          <!-- Grabber -->
          <div class="flex justify-center pt-2.5">
            <span class="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600"></span>
          </div>

          <div class="flex items-center justify-between px-4 pb-2 pt-3">
            <h3
              id="view-options-sheet-title"
              class="text-base font-semibold text-gray-900 dark:text-white"
            >
              View options
            </h3>
            <button
              @click="showViewOptions = false"
              class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 active:bg-gray-100 dark:active:bg-gray-700"
              aria-label="Close view options"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <div class="space-y-4 px-4 pt-1">
            <!-- Layout -->
            <div>
              <p
                class="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400"
              >
                Layout
              </p>
              <div class="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-700">
                <button
                  v-for="option in [
                    { value: 'grid', label: 'Grid', icon: Grid3x3 },
                    { value: 'list', label: 'List', icon: List },
                  ]"
                  :key="option.value"
                  @click="selectLayout(option.value)"
                  :class="[
                    'flex h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors',
                    layoutMode === option.value
                      ? 'bg-white text-primary shadow-sm dark:bg-gray-600'
                      : 'text-gray-500 dark:text-gray-300',
                  ]"
                  :aria-pressed="layoutMode === option.value"
                >
                  <component :is="option.icon" class="h-4.5 w-4.5" />
                  {{ option.label }}
                </button>
              </div>
            </div>

            <!-- Card detail -->
            <div>
              <p
                class="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400"
              >
                Card detail
              </p>
              <div class="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-700">
                <button
                  v-for="option in [
                    { value: 'simple', label: 'Simple' },
                    { value: 'detailed', label: 'Detailed' },
                  ]"
                  :key="option.value"
                  @click="selectViewMode(option.value)"
                  :class="[
                    'h-11 flex-1 rounded-lg text-sm font-medium transition-colors',
                    viewMode === option.value
                      ? 'bg-white text-primary shadow-sm dark:bg-gray-600'
                      : 'text-gray-500 dark:text-gray-300',
                  ]"
                  :aria-pressed="viewMode === option.value"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>

            <!-- Secondary actions -->
            <div
              class="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 dark:divide-gray-700 dark:border-gray-700"
            >
              <button
                @click="handleExport"
                class="flex w-full items-center gap-3 px-3.5 py-3.5 text-left transition-colors active:bg-gray-50 dark:active:bg-gray-700/50"
              >
                <Download class="h-5 w-5 shrink-0 text-gray-400" />
                <span
                  class="flex-1 text-sm font-medium text-gray-900 dark:text-white"
                >
                  Export members
                </span>
                <ChevronRight class="h-4 w-4 shrink-0 text-gray-300" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.25s ease;
}

.sheet-enter-active .sheet-panel,
.sheet-leave-active .sheet-panel {
  transition: transform 0.25s ease;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .sheet-panel,
.sheet-leave-to .sheet-panel {
  transform: translateY(100%);
}
</style>
