<script setup>
import { computed, ref } from "vue";
import {
  Grid3x3,
  LayoutGrid,
  List,
  ListTodo,
  SlidersHorizontal,
  Plus,
  Filter,
  Download,
} from "lucide-vue-next";
import SearchBar from "../common/SearchBar.vue";

const mobileSearchOpen = ref(false);

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
        >
          <Filter class="h-5 w-5" />
          <span
            v-if="hasActiveFilters"
            class="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#bc1c09]"
          ></span>
        </button>

        <!-- Add Member Button -->
        <button
          @click="
            emit('update:showFilters', false);
            emit('update:showConfig', false);
            emit('update:showAddMember', !showAddMember);
          "
          class="flex h-10 items-center justify-center rounded-lg bg-primary text-white shadow-sm transition-colors hover:bg-primary-hover dark:bg-primary dark:hover:bg-primary-hover px-2.5 sm:px-4 gap-1.5 w-10 sm:w-auto shrink-0"
          :title="showAddMember ? 'Close add member form' : 'Add new member'"
        >
          <Plus class="h-5 w-5 transition-transform duration-300 ease-in-out shrink-0" :class="{ 'rotate-45': showAddMember }" />
          <span class="hidden sm:inline whitespace-nowrap">Add</span>
        </button>

        <!-- Configuration Button -->
        <button
          :disabled="viewMode === 'simple'"
          @click="emit('update:showConfig', !showConfig)"
          :class="[
            'relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors shrink-0',
            viewMode === 'simple'
              ? 'cursor-not-allowed bg-gray-100 text-gray-400 opacity-50 dark:bg-gray-700 dark:text-gray-500'
              : showConfig
              ? 'bg-primary text-white shadow-sm dark:bg-primary'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
          ]"
          :title="viewMode === 'simple' ? 'Configure visible fields (available in detailed view)' : 'Configure visible fields'"
        >
          <SlidersHorizontal class="h-5 w-5" />
        </button>

        <!-- View Mode Controls -->
        <div class="flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700 shrink-0">
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
          class="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 shrink-0"
          title="Export to Google Sheets"
        >
          <Download class="h-5 w-5" />
        </button>
      </div>
    </div>
  </div>
</template>

