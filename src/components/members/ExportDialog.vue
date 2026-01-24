<script setup>
import { ref, computed } from "vue";
import { X, Download, FileSpreadsheet, ArrowUpDown, ArrowUp, ArrowDown, Check, Filter, Columns, Users, Tag } from "lucide-vue-next";

const props = defineProps({
  showExport: {
    type: Boolean,
    default: false,
  },
  members: {
    type: Array,
    default: () => [],
  },
  allTags: {
    type: Array,
    default: () => [],
  },
  currentSortBy: {
    type: String,
    default: "name",
  },
  currentSortOrder: {
    type: String,
    default: "asc",
  },
  currentFilters: {
    type: Object,
    default: () => ({
      tags: [],
      isMember: null,
      sex: null,
      civilStatus: null,
    }),
  },
});

const emit = defineEmits(["update:showExport", "export"]);

// Export configuration
const exportConfig = ref({
  sortBy: props.currentSortBy,
  sortOrder: props.currentSortOrder,
  useCurrentFilters: true,
  filters: {
    tags: [...props.currentFilters.tags],
    isMember: props.currentFilters.isMember,
    sex: props.currentFilters.sex,
    civilStatus: props.currentFilters.civilStatus,
  },
  fields: {
    id: false,
    firstName: true,
    lastName: true,
    nickname: true,
    sex: true,
    dateOfBirth: true,
    age: true,
    civilStatus: true,
    address: true,
    contactNumber: true,
    occupation: true,
    tags: true,
    isMember: true,
  },
});

// Available sort options
const sortOptions = [
  { value: "name", label: "Name" },
  { value: "age", label: "Age" },
  { value: "dateOfBirth", label: "Birth Date" },
];

// Available fields grouped
const fieldGroups = [
  {
    label: "Identity",
    fields: [
      { key: "id", label: "ID" },
      { key: "firstName", label: "First Name" },
      { key: "lastName", label: "Last Name" },
      { key: "nickname", label: "Nickname" },
    ]
  },
  {
    label: "Personal",
    fields: [
      { key: "sex", label: "Gender" },
      { key: "dateOfBirth", label: "Date of Birth" },
      { key: "age", label: "Age" },
      { key: "civilStatus", label: "Civil Status" },
    ]
  },
  {
    label: "Contact & Church",
    fields: [
      { key: "address", label: "Address" },
      { key: "contactNumber", label: "Contact" },
      { key: "occupation", label: "Occupation" },
      { key: "tags", label: "Tags" },
      { key: "isMember", label: "Member Status" },
    ]
  }
];

// Count selected fields
const selectedFieldCount = computed(() => {
  return Object.values(exportConfig.value.fields).filter(Boolean).length;
});

// Estimated row count
const estimatedRows = computed(() => {
  if (exportConfig.value.useCurrentFilters) {
    // Rough estimate based on current filters
    return props.members.length;
  }
  return props.members.length;
});

const toggleField = (fieldKey) => {
  exportConfig.value.fields[fieldKey] = !exportConfig.value.fields[fieldKey];
};

const selectAllFields = () => {
  Object.keys(exportConfig.value.fields).forEach(key => {
    exportConfig.value.fields[key] = true;
  });
};

const deselectAllFields = () => {
  Object.keys(exportConfig.value.fields).forEach(key => {
    exportConfig.value.fields[key] = false;
  });
};

const toggleTag = (tag) => {
  const index = exportConfig.value.filters.tags.indexOf(tag);
  if (index > -1) {
    exportConfig.value.filters.tags.splice(index, 1);
  } else {
    exportConfig.value.filters.tags.push(tag);
  }
};

const handleExport = () => {
  emit("export", exportConfig.value);
  emit("update:showExport", false);
};
</script>

<template>
  <Transition name="modal">
    <div
      v-if="showExport"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      @click.self="$emit('update:showExport', false)"
    >
      <div
        class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700"
      >
        <!-- Header -->
        <div class="flex-shrink-0 px-6 py-5 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="p-2.5 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-500/30">
                <FileSpreadsheet class="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 class="text-xl font-bold text-gray-900 dark:text-white">
                  Export to Spreadsheet
                </h2>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Download as Excel file (.xlsx)
                </p>
              </div>
            </div>
            <button
              @click="$emit('update:showExport', false)"
              class="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X class="h-5 w-5" />
            </button>
          </div>
        </div>

        <!-- Scrollable Content -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          <!-- Quick Stats -->
          <div class="flex gap-4">
            <div class="flex-1 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <div class="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                <Users class="h-4 w-4" />
                <span class="text-xs font-medium">Records</span>
              </div>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ estimatedRows }}</p>
            </div>
            <div class="flex-1 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <div class="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                <Columns class="h-4 w-4" />
                <span class="text-xs font-medium">Columns</span>
              </div>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ selectedFieldCount }}</p>
            </div>
          </div>

          <!-- Sort & Filter Section -->
          <div class="grid grid-cols-2 gap-4">
            <!-- Sort Options -->
            <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-3">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <ArrowUpDown class="h-4 w-4 text-emerald-500" />
                Sort By
              </h3>
              <select
                v-model="exportConfig.sortBy"
                class="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option v-for="option in sortOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <button
                @click="exportConfig.sortOrder = exportConfig.sortOrder === 'asc' ? 'desc' : 'asc'"
                class="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <ArrowUp v-if="exportConfig.sortOrder === 'asc'" class="h-4 w-4" />
                <ArrowDown v-else class="h-4 w-4" />
                {{ exportConfig.sortOrder === 'asc' ? 'Ascending' : 'Descending' }}
              </button>
            </div>

            <!-- Filter Toggle -->
            <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-3">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Filter class="h-4 w-4 text-emerald-500" />
                Filters
              </h3>
              <button
                @click="exportConfig.useCurrentFilters = !exportConfig.useCurrentFilters"
                :class="[
                  'w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all',
                  exportConfig.useCurrentFilters
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                ]"
              >
                <span :class="exportConfig.useCurrentFilters ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'" class="text-sm font-medium">
                  Use current filters
                </span>
                <div
                  :class="[
                    'w-5 h-5 rounded-full flex items-center justify-center transition-colors',
                    exportConfig.useCurrentFilters ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-gray-600'
                  ]"
                >
                  <Check v-if="exportConfig.useCurrentFilters" class="h-3 w-3" />
                </div>
              </button>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ exportConfig.useCurrentFilters ? 'Will use your current member filters' : 'Export all members without filters' }}
              </p>
            </div>
          </div>

          <!-- Field Selection -->
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Columns class="h-4 w-4 text-emerald-500" />
                Columns to Export
              </h3>
              <div class="flex gap-2">
                <button
                  @click="selectAllFields"
                  class="px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                >
                  Select All
                </button>
                <button
                  @click="deselectAllFields"
                  class="px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>

            <div class="space-y-4">
              <div v-for="group in fieldGroups" :key="group.label" class="space-y-2">
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ group.label }}</p>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="field in group.fields"
                    :key="field.key"
                    @click="toggleField(field.key)"
                    :class="[
                      'px-3 py-1.5 text-sm rounded-lg transition-all flex items-center gap-1.5',
                      exportConfig.fields[field.key]
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    ]"
                  >
                    <Check v-if="exportConfig.fields[field.key]" class="h-3.5 w-3.5" />
                    {{ field.label }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex-shrink-0 px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ estimatedRows }} records × {{ selectedFieldCount }} columns
            </p>
            <div class="flex gap-3">
              <button
                @click="$emit('update:showExport', false)"
                class="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                @click="handleExport"
                :disabled="selectedFieldCount === 0"
                :class="[
                  'px-5 py-2.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-2',
                  selectedFieldCount > 0
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/40'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                ]"
              >
                <Download class="h-4 w-4" />
                Export Excel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active > div,
.modal-leave-active > div {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div,
.modal-leave-to > div {
  opacity: 0;
  transform: scale(0.95);
}
</style>
