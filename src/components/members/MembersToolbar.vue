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
    const newMode = props.viewMode === "simple" ? "detailed" : "simple";
    emit("update:viewMode", newMode);
    if (newMode === "simple") emit("update:showConfig", false);
  } else {
    emit("update:layoutMode", "grid");
    emit("update:viewMode", "simple");
    emit("update:showConfig", false);
  }
};

const handleListModeToggle = () => {
  if (props.layoutMode === "list") {
    const newMode = props.viewMode === "simple" ? "detailed" : "simple";
    emit("update:viewMode", newMode);
    if (newMode === "simple") emit("update:showConfig", false);
  } else {
    emit("update:layoutMode", "list");
    emit("update:viewMode", "simple");
    emit("update:showConfig", false);
  }
};
</script>

<template>
  <div class="sticky top-0 z-40 mb-4 flex-shrink-0 flex items-center gap-3 bg-white dark:bg-gray-900 py-2">
    <div class="relative flex-1">
      <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
      <input
        :value="searchQuery"
        @input="$emit('update:searchQuery', $event.target.value)"
        type="text"
        placeholder="Search members..."
        class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
      />
    </div>

    <!-- Filter Button -->
    <button
      @click="emit('update:showFilters', !showFilters)"
      :class="[
        'p-2 rounded-lg transition-colors relative',
        showFilters || hasActiveFilters
          ? 'bg-[#01779b] dark:bg-[#01779b] text-white shadow-sm'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
      ]"
      title="Filter members"
    >
      <Filter class="h-5 w-5" />
      <span
        v-if="hasActiveFilters"
        class="absolute -top-1 -right-1 w-2 h-2 bg-[#bc1c09] rounded-full"
      ></span>
    </button>

    <!-- Configuration Button -->
    <button
      :disabled="viewMode === 'simple'"
      @click="emit('update:showConfig', !showConfig)"
      :class="[
        'p-2 rounded-lg transition-colors relative',
        viewMode === 'simple'
          ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50'
          : showConfig
          ? 'bg-[#01779b] dark:bg-[#01779b] text-white shadow-sm'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
      ]"
      :title="viewMode === 'simple' ? 'Configure visible fields (available in detailed view)' : 'Configure visible fields'"
    >
      <SlidersHorizontal class="h-5 w-5" />
    </button>

    <!-- View Mode Controls -->
    <div class="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
      <button
        @click="handleViewModeToggle"
        :class="[
          'p-1.5 rounded transition-colors',
          layoutMode === 'grid'
            ? 'bg-white dark:bg-gray-600 text-[#01779b] dark:text-[#01779b] shadow-sm'
            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white',
        ]"
        :title="
          layoutMode === 'grid'
            ? viewMode === 'simple'
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
          'p-1.5 rounded transition-colors',
          layoutMode === 'list'
            ? 'bg-white dark:bg-gray-600 text-[#01779b] dark:text-[#01779b] shadow-sm'
            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white',
        ]"
        :title="
          layoutMode === 'list'
            ? viewMode === 'simple'
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
      class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
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
      class="p-2 px-4 rounded-lg bg-[#01779b] dark:bg-[#01779b] text-white hover:bg-[#015a77] dark:hover:bg-[#015a77] transition-colors shadow-sm"
      :title="showAddMember ? 'Close add member form' : 'Add new member'"
    >
      <Plus 
        class="h-5 w-5 transition-transform duration-300 ease-in-out" 
        :class="{ 'rotate-45': showAddMember }"
      />
    </button>
  </div>
</template>

