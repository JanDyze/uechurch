<script setup>
import { computed } from "vue";
import {
  Search,
  Grid3x3,
  LayoutGrid,
  List,
  ListTodo,
  SlidersHorizontal,
  Plus,
  Filter,
  Download,
} from "lucide-vue-next";

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
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div class="relative w-full sm:flex-1">
        <Search class="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          :value="searchQuery"
          @input="$emit('update:searchQuery', $event.target.value)"
          type="text"
          placeholder="Search members..."
          class="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
      </div>

      <div class="flex flex-wrap items-center gap-2 sm:ml-auto">
        <!-- Filter Button -->
        <button
          @click="emit('update:showFilters', !showFilters)"
          :class="[
            'relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors sm:h-10 sm:w-10',
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

        <!-- Configuration Button -->
        <button
          :disabled="viewMode === 'simple'"
          @click="emit('update:showConfig', !showConfig)"
          :class="[
            'relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
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
        <div class="flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
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
          class="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          title="Export to Google Sheets"
        >
          <Download class="h-5 w-5" />
        </button>

        <!-- Add Member Button -->
        <button
          @click="
            emit('update:showFilters', false);
            emit('update:showConfig', false);
            emit('update:showAddMember', !showAddMember);
          "
          class="flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-hover dark:bg-primary dark:hover:bg-primary-hover sm:px-4"
          :title="showAddMember ? 'Close add member form' : 'Add new member'"
        >
          <Plus class="h-5 w-5 transition-transform duration-300 ease-in-out" :class="{ 'rotate-45': showAddMember }" />
          <span class="whitespace-nowrap">Add</span>
        </button>
      </div>
    </div>
  </div>
</template>

