<script setup>
import { ref, computed, watch } from "vue";
import { X, Download, FileSpreadsheet, ArrowUpDown, ArrowUp, ArrowDown, Check, Filter, Columns, Users } from '../../icons';
import { useFocusTrap } from "../../composables/useFocusTrap";

const props = defineProps({
  showExport: {
    type: Boolean,
    default: false,
  },
  members: {
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
  visibleCount: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits(["update:showExport", "export"]);

// Export configuration
const exportConfig = ref({
  sortBy: props.currentSortBy,
  sortOrder: props.currentSortOrder,
  onlyVisible: false,
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

const isSearchNarrowing = computed(() => props.visibleCount < props.members.length);

const estimatedRows = computed(() =>
  exportConfig.value.onlyVisible ? props.visibleCount : props.members.length
);

// The dialog stays mounted, so pick up the page's current search and sort
// each time it opens rather than freezing whatever they were at startup.
watch(() => props.showExport, (isOpen) => {
  if (!isOpen) return;
  exportConfig.value.sortBy = props.currentSortBy;
  exportConfig.value.sortOrder = props.currentSortOrder;
  exportConfig.value.onlyVisible = isSearchNarrowing.value;
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

const handleExport = () => {
  emit("export", exportConfig.value);
  emit("update:showExport", false);
};

const dialogRef = ref(null);
useFocusTrap(dialogRef, () => props.showExport, () => emit("update:showExport", false));
</script>

<template>
  <Transition name="modal">
    <div
      v-if="showExport"
      class="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      @click.self="$emit('update:showExport', false)"
    >
      <div
        ref="dialogRef"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        tabindex="-1"
        class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700"
      >
        <!-- Header -->
        <div class="shrink-0 px-4 py-4 sm:px-6 sm:py-5 bg-linear-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="p-2.5 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-500/30 shrink-0">
                <FileSpreadsheet class="h-6 w-6 text-white" />
              </div>
              <div class="min-w-0">
                <h2 id="export-dialog-title" class="text-base sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                  Export to Spreadsheet
                </h2>
                <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                  Download as Excel file (.xlsx)
                </p>
              </div>
            </div>
            <button
              @click="$emit('update:showExport', false)"
              aria-label="Close"
              class="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
            >
              <X class="h-5 w-5" />
            </button>
          </div>
        </div>

        <!-- Scrollable Content -->
        <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
          <!-- Quick Stats -->
          <div class="flex gap-3 sm:gap-4">
            <div class="flex-1 p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <div class="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                <Users class="h-4 w-4" />
                <span class="text-xs font-medium">Records</span>
              </div>
              <p class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{{ estimatedRows }}</p>
            </div>
            <div class="flex-1 p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <div class="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                <Columns class="h-4 w-4" />
                <span class="text-xs font-medium">Columns</span>
              </div>
              <p class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{{ selectedFieldCount }}</p>
            </div>
          </div>

          <!-- Sort & Filter Section -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <!-- Row Scope -->
            <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-3">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Filter class="h-4 w-4 text-emerald-500" />
                Rows
              </h3>
              <button
                @click="exportConfig.onlyVisible = !exportConfig.onlyVisible"
                :disabled="!isSearchNarrowing"
                :class="[
                  'w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all',
                  !isSearchNarrowing
                    ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 opacity-50 cursor-not-allowed'
                    : exportConfig.onlyVisible
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                ]"
              >
                <span :class="exportConfig.onlyVisible ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'" class="text-sm font-medium">
                  Only my search results
                </span>
                <div
                  :class="[
                    'w-5 h-5 rounded-full flex items-center justify-center transition-colors',
                    exportConfig.onlyVisible ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-gray-600'
                  ]"
                >
                  <Check v-if="exportConfig.onlyVisible" class="h-3 w-3" />
                </div>
              </button>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                <template v-if="!isSearchNarrowing">Search the members list first to export just part of it</template>
                <template v-else-if="exportConfig.onlyVisible">Exporting the {{ visibleCount }} members your search is showing</template>
                <template v-else>Exporting all {{ members.length }} members</template>
              </p>
            </div>
          </div>

          <!-- Field Selection -->
          <div class="space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Columns class="h-4 w-4 text-emerald-500" />
                Columns to Export
              </h3>
              <div class="flex gap-2 shrink-0">
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
        <div class="shrink-0 px-4 py-4 sm:px-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
          <div class="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
            <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center sm:text-left">
              {{ estimatedRows }} records × {{ selectedFieldCount }} columns
            </p>
            <div class="flex gap-3">
              <button
                @click="$emit('update:showExport', false)"
                class="flex-1 sm:flex-none px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                @click="handleExport"
                :disabled="selectedFieldCount === 0"
                :class="[
                  'flex-1 sm:flex-none px-5 py-2.5 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2',
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
