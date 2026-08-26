<script setup>
import { computed, ref, onMounted, onUnmounted } from "vue";
import {
  Grid3x3,
  LayoutGrid,
  List,
  ListTodo,
  SlidersHorizontal,
  Plus,
  Filter,
  Download,
  MoreVertical,
  Tag,
} from "lucide-vue-next";
import SearchBar from "../common/SearchBar.vue";
import { useFocusTrap } from "../../composables/useFocusTrap";

const mobileSearchOpen = ref(false);
const showOverflowMenu = ref(false);
const showTagManager = ref(false);
const newTagInput = ref("");

const props = defineProps({
  searchQuery: {
    type: String,
    default: "",
  },
  allTags: {
    type: Array,
    default: () => [],
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
  showConfig: {
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
});

const emit = defineEmits([
  "update:searchQuery",
  "update:viewMode",
  "update:layoutMode",
  "update:showFilters",
  "update:showConfig",
  "update:showAddMember",
  "export",
  "switchLayout",
  "addTag",
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
    const newMode = props.viewMode === "simple" ? "detailed" : "simple";
    emit("update:viewMode", newMode);
    if (newMode === "simple") emit("update:showConfig", false);
  } else {
    // Switch to grid mode
    emit("update:showConfig", false);
    emit("switchLayout", { layout: "grid", viewMode: "simple" });
  }
};

const handleListModeToggle = () => {
  if (props.layoutMode === "list") {
    // Already in list, toggle between simple/detailed
    const newMode = props.viewMode === "simple" ? "detailed" : "simple";
    emit("update:viewMode", newMode);
    if (newMode === "simple") emit("update:showConfig", false);
  } else {
    // Switch to list mode
    emit("update:showConfig", false);
    emit("switchLayout", { layout: "list", viewMode: "simple" });
  }
};

const handleConfigToggle = () => {
  if (props.viewMode === "simple") return;
  emit("update:showConfig", !props.showConfig);
  showOverflowMenu.value = false;
};

const handleExportClick = () => {
  emit("export");
  showOverflowMenu.value = false;
};

const closeOverflowMenu = () => {
  showOverflowMenu.value = false;
  showTagManager.value = false;
};

const overflowMenuRef = ref(null);
useFocusTrap(overflowMenuRef, showOverflowMenu, closeOverflowMenu, { trap: false });

const tagManagerRef = ref(null);
useFocusTrap(tagManagerRef, showTagManager, closeOverflowMenu, { trap: false });

const handleAddTag = () => {
  const trimmed = newTagInput.value.trim();
  if (!trimmed) return;
  emit("addTag", trimmed);
  newTagInput.value = "";
};

onMounted(() => {
  window.addEventListener("click", closeOverflowMenu);
});

onUnmounted(() => {
  window.removeEventListener("click", closeOverflowMenu);
});
</script>

<template>
  <div class="sticky top-0 z-40 mb-4 shrink-0 rounded-xl border border-gray-200/80 bg-white/95 px-2 py-2 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 sm:px-3">
    <div class="flex items-center justify-between gap-2 w-full flex-nowrap">
      <SearchBar
        :model-value="searchQuery"
        @update:model-value="$emit('update:searchQuery', $event)"
        v-model:open="mobileSearchOpen"
        placeholder="Search members..."
      />

      <div :class="['flex items-center gap-1.5 sm:gap-2 flex-nowrap shrink-0 ml-auto', mobileSearchOpen ? 'hidden lg:flex' : 'flex']">
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
          aria-label="Filter members"
        >
          <Filter class="h-5 w-5" />
          <span
            v-if="hasActiveFilters"
            class="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#bc1c09]"
          ></span>
        </button>

        <!-- Tag Manager Button -->
        <div class="relative shrink-0">
          <button
            @click.stop="showTagManager = !showTagManager; showOverflowMenu = false"
            :class="[
              'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
              showTagManager
                ? 'bg-primary text-white shadow-sm dark:bg-primary'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
            ]"
            title="Manage ministry tags"
            aria-label="Manage ministry tags"
            aria-haspopup="true"
            :aria-expanded="showTagManager"
          >
            <Tag class="h-5 w-5" />
          </button>

          <Transition name="fade">
            <div
              v-if="showTagManager"
              ref="tagManagerRef"
              role="dialog"
              aria-label="Manage ministry tags"
              tabindex="-1"
              @click.stop
              class="absolute right-0 top-full mt-2 w-64 rounded-xl border border-gray-100 bg-white p-3 shadow-2xl dark:border-gray-700 dark:bg-gray-800 z-50"
            >
              <p class="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Ministry Tags
              </p>
              <div v-if="allTags.length > 0" class="flex flex-wrap gap-1.5 mb-3 max-h-32 overflow-y-auto">
                <span
                  v-for="tag in allTags"
                  :key="tag"
                  class="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                >
                  {{ tag }}
                </span>
              </div>
              <div class="flex items-center gap-1.5">
                <input
                  v-model="newTagInput"
                  type="text"
                  placeholder="New tag name..."
                  @keydown.enter.prevent="handleAddTag"
                  class="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-primary-light/20"
                />
                <button
                  type="button"
                  @click="handleAddTag"
                  :disabled="!newTagInput.trim()"
                  class="p-1.5 rounded-md bg-primary dark:bg-primary-light text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-hover dark:hover:bg-[#1a9aab] transition-colors shrink-0"
                  title="Add tag"
                  aria-label="Add tag"
                >
                  <Plus class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Configuration Button (desktop) -->
        <button
          :disabled="viewMode === 'simple'"
          @click="emit('update:showConfig', !showConfig)"
          :class="[
            'relative hidden lg:flex h-10 w-10 items-center justify-center rounded-lg transition-colors shrink-0',
            viewMode === 'simple'
              ? 'cursor-not-allowed bg-gray-100 text-gray-400 opacity-50 dark:bg-gray-700 dark:text-gray-500'
              : showConfig
              ? 'bg-primary text-white shadow-sm dark:bg-primary'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
          ]"
          :title="viewMode === 'simple' ? 'Configure visible fields (available in detailed view)' : 'Configure visible fields'"
          :aria-label="viewMode === 'simple' ? 'Configure visible fields (available in detailed view)' : 'Configure visible fields'"
        >
          <SlidersHorizontal class="h-5 w-5" />
        </button>

        <!-- View Mode Controls (desktop) -->
        <div class="hidden lg:flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700 shrink-0">
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
            :aria-label="
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
            :aria-label="
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

        <!-- Export Button (desktop) -->
        <button
          @click="emit('export')"
          class="hidden lg:flex h-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 px-2.5 sm:px-4 gap-1 sm:gap-1.5 shrink-0"
          title="Export to Google Sheets"
        >
          <Download class="h-5 w-5 shrink-0" />
          <span class="whitespace-nowrap text-xs sm:text-sm">Export</span>
        </button>

        <!-- Overflow Menu (mobile): Configuration, View Mode, Export -->
        <div class="relative lg:hidden shrink-0">
          <button
            @click.stop="showOverflowMenu = !showOverflowMenu"
            :class="[
              'relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
              showOverflowMenu || showConfig
                ? 'bg-primary text-white shadow-sm dark:bg-primary'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
            ]"
            title="More options"
            aria-label="More options"
            aria-haspopup="true"
            :aria-expanded="showOverflowMenu"
          >
            <MoreVertical class="h-5 w-5" />
          </button>

          <Transition name="fade">
            <div
              v-if="showOverflowMenu"
              ref="overflowMenuRef"
              role="menu"
              aria-label="More options"
              tabindex="-1"
              @click.stop
              class="absolute right-0 top-full mt-2 w-56 rounded-xl border border-gray-100 bg-white py-2 shadow-2xl dark:border-gray-700 dark:bg-gray-800 z-50 overflow-hidden"
            >
              <!-- Layout Section -->
              <div class="px-3 pb-2">
                <p class="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Layout
                </p>
                <div class="flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
                  <button
                    @click="handleViewModeToggle"
                    :class="[
                      'flex flex-1 items-center justify-center gap-1.5 rounded p-1.5 text-xs font-medium transition-colors',
                      props.layoutMode === 'grid'
                        ? 'bg-white text-primary shadow-sm dark:bg-gray-600 dark:text-primary'
                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white',
                    ]"
                  >
                    <component :is="gridIcon" class="h-4 w-4" />
                    Grid
                  </button>
                  <button
                    @click="handleListModeToggle"
                    :class="[
                      'flex flex-1 items-center justify-center gap-1.5 rounded p-1.5 text-xs font-medium transition-colors',
                      props.layoutMode === 'list'
                        ? 'bg-white text-primary shadow-sm dark:bg-gray-600 dark:text-primary'
                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white',
                    ]"
                  >
                    <component :is="listIcon" class="h-4 w-4" />
                    List
                  </button>
                </div>
              </div>

              <div class="my-1 h-px bg-gray-100 dark:bg-gray-700"></div>

              <button
                :disabled="viewMode === 'simple'"
                @click="handleConfigToggle"
                :class="[
                  'flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors',
                  viewMode === 'simple'
                    ? 'cursor-not-allowed text-gray-400 dark:text-gray-500'
                    : showConfig
                    ? 'text-primary dark:text-primary-light'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700',
                ]"
                :title="viewMode === 'simple' ? 'Configure visible fields (available in detailed view)' : 'Configure visible fields'"
              >
                <SlidersHorizontal class="h-4 w-4" />
                Configure Fields
              </button>

              <button
                @click="handleExportClick"
                class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Download class="h-4 w-4" />
                Export
              </button>
            </div>
          </Transition>
        </div>

        <!-- Add Member Button -->
        <button
          @click="
            emit('update:showFilters', false);
            emit('update:showConfig', false);
            emit('update:showAddMember', !showAddMember);
            showOverflowMenu = false;
          "
          class="flex h-10 items-center justify-center rounded-lg bg-primary text-white shadow-sm transition-colors hover:bg-primary-hover dark:bg-primary dark:hover:bg-primary-hover px-2.5 sm:px-4 gap-1 sm:gap-1.5 shrink-0"
          :title="showAddMember ? 'Close add member form' : 'Add new member'"
        >
          <Plus class="h-5 w-5 transition-transform duration-300 ease-in-out shrink-0" :class="{ 'rotate-45': showAddMember }" />
          <span class="whitespace-nowrap text-xs sm:text-sm">Add</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>

