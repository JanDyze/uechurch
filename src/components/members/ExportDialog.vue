<script setup>
import { ref, computed } from "vue";
import { X, Download, ArrowUpDown } from "lucide-vue-next";

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
  // Sort options
  sortBy: props.currentSortBy,
  sortOrder: props.currentSortOrder,
  
  // Filter options
  useCurrentFilters: true,
  filters: {
    tags: [...props.currentFilters.tags],
    isMember: props.currentFilters.isMember,
    sex: props.currentFilters.sex,
    civilStatus: props.currentFilters.civilStatus,
  },
  
  // Field selection
  fields: {
    id: true,
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
    familyRole: true,
  },
});

// Available sort options
const sortOptions = [
  { value: "name", label: "Name" },
  { value: "age", label: "Age" },
  { value: "dateOfBirth", label: "Birth Date" },
];

// Available fields
const availableFields = [
  { key: "id", label: "ID" },
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "nickname", label: "Nickname" },
  { key: "sex", label: "Gender" },
  { key: "dateOfBirth", label: "Date of Birth" },
  { key: "age", label: "Age" },
  { key: "civilStatus", label: "Civil Status" },
  { key: "address", label: "Address" },
  { key: "contactNumber", label: "Contact Number" },
  { key: "occupation", label: "Occupation" },
  { key: "tags", label: "Tags" },
  { key: "isMember", label: "Is Member" },
  { key: "familyRole", label: "Family Role" },
];

const toggleField = (fieldKey) => {
  exportConfig.value.fields[fieldKey] = !exportConfig.value.fields[fieldKey];
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
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      @click.self="$emit('update:showExport', false)"
    >
      <div
        class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
      >
        <!-- Header -->
        <div class="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Download class="h-5 w-5" />
            Export to Google Sheets
          </h2>
          <button
            @click="$emit('update:showExport', false)"
            class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <!-- Scrollable Content -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          <!-- Sort Options -->
          <div>
            <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-3">Sort Options</h3>
            <div class="space-y-3">
              <div>
                <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sort By
                </label>
                <select
                  v-model="exportConfig.sortBy"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
                >
                  <option v-for="option in sortOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </div>
              <div>
                <button
                  @click="exportConfig.sortOrder = exportConfig.sortOrder === 'asc' ? 'desc' : 'asc'"
                  class="w-full flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  <ArrowUpDown class="h-4 w-4" />
                  <span>{{ exportConfig.sortOrder === 'asc' ? 'Ascending' : 'Descending' }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Filter Options -->
          <div>
            <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-3">Filter Options</h3>
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-700 dark:text-gray-300">Use current filters</span>
                <button
                  type="button"
                  @click="exportConfig.useCurrentFilters = !exportConfig.useCurrentFilters"
                  :class="[
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#01779b] focus:ring-offset-2',
                    exportConfig.useCurrentFilters ? 'bg-[#01779b]' : 'bg-gray-300 dark:bg-gray-600'
                  ]"
                >
                  <span
                    :class="[
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      exportConfig.useCurrentFilters ? 'translate-x-6' : 'translate-x-1'
                    ]"
                  ></span>
                </button>
              </div>

              <div v-if="!exportConfig.useCurrentFilters" class="space-y-3 pl-6 border-l-2 border-gray-200 dark:border-gray-700">
                <!-- Tags Filter -->
                <div>
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tags
                  </label>
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="tag in allTags"
                      :key="tag"
                      @click="toggleTag(tag)"
                      :class="[
                        'px-3 py-1 text-xs rounded-full transition-colors',
                        exportConfig.filters.tags.includes(tag)
                          ? 'bg-[#01779b] text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                      ]"
                    >
                      {{ tag }}
                    </button>
                  </div>
                </div>

                <!-- Member Status Filter -->
                <div>
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Member Status
                  </label>
                  <div class="flex gap-2">
                    <button
                      @click="exportConfig.filters.isMember = null"
                      :class="[
                        'px-3 py-1 text-xs rounded-lg transition-colors',
                        exportConfig.filters.isMember === null
                          ? 'bg-[#01779b] text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                      ]"
                    >
                      All
                    </button>
                    <button
                      @click="exportConfig.filters.isMember = true"
                      :class="[
                        'px-3 py-1 text-xs rounded-lg transition-colors',
                        exportConfig.filters.isMember === true
                          ? 'bg-[#01779b] text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                      ]"
                    >
                      Members
                    </button>
                    <button
                      @click="exportConfig.filters.isMember = false"
                      :class="[
                        'px-3 py-1 text-xs rounded-lg transition-colors',
                        exportConfig.filters.isMember === false
                          ? 'bg-[#01779b] text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                      ]"
                    >
                      Non-Members
                    </button>
                  </div>
                </div>

                <!-- Sex Filter -->
                <div>
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Gender
                  </label>
                  <div class="flex gap-2">
                    <button
                      @click="exportConfig.filters.sex = null"
                      :class="[
                        'px-3 py-1 text-xs rounded-lg transition-colors',
                        exportConfig.filters.sex === null
                          ? 'bg-[#01779b] text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                      ]"
                    >
                      All
                    </button>
                    <button
                      @click="exportConfig.filters.sex = 'Male'"
                      :class="[
                        'px-3 py-1 text-xs rounded-lg transition-colors',
                        exportConfig.filters.sex === 'Male'
                          ? 'bg-[#01779b] text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                      ]"
                    >
                      Male
                    </button>
                    <button
                      @click="exportConfig.filters.sex = 'Female'"
                      :class="[
                        'px-3 py-1 text-xs rounded-lg transition-colors',
                        exportConfig.filters.sex === 'Female'
                          ? 'bg-[#01779b] text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                      ]"
                    >
                      Female
                    </button>
                  </div>
                </div>

                <!-- Civil Status Filter -->
                <div>
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Civil Status
                  </label>
                  <div class="flex gap-2 flex-wrap">
                    <button
                      @click="exportConfig.filters.civilStatus = null"
                      :class="[
                        'px-3 py-1 text-xs rounded-lg transition-colors',
                        exportConfig.filters.civilStatus === null
                          ? 'bg-[#01779b] text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                      ]"
                    >
                      All
                    </button>
                    <button
                      @click="exportConfig.filters.civilStatus = 'Single'"
                      :class="[
                        'px-3 py-1 text-xs rounded-lg transition-colors',
                        exportConfig.filters.civilStatus === 'Single'
                          ? 'bg-[#01779b] text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                      ]"
                    >
                      Single
                    </button>
                    <button
                      @click="exportConfig.filters.civilStatus = 'Married'"
                      :class="[
                        'px-3 py-1 text-xs rounded-lg transition-colors',
                        exportConfig.filters.civilStatus === 'Married'
                          ? 'bg-[#01779b] text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                      ]"
                    >
                      Married
                    </button>
                    <button
                      @click="exportConfig.filters.civilStatus = 'Divorced'"
                      :class="[
                        'px-3 py-1 text-xs rounded-lg transition-colors',
                        exportConfig.filters.civilStatus === 'Divorced'
                          ? 'bg-[#01779b] text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                      ]"
                    >
                      Divorced
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Field Selection -->
          <div>
            <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-3">Fields to Include</h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              <button
                v-for="field in availableFields"
                :key="field.key"
                type="button"
                @click="toggleField(field.key)"
                :class="[
                  'px-3 py-2 text-xs rounded-lg transition-colors text-left',
                  exportConfig.fields[field.key]
                    ? 'bg-[#01779b] text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                ]"
              >
                {{ field.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            @click="$emit('update:showExport', false)"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            @click="handleExport"
            class="px-4 py-2 text-sm font-medium text-white bg-[#01779b] dark:bg-[#01779b] rounded-lg hover:bg-[#015a77] dark:hover:bg-[#015a77] transition-colors flex items-center gap-2"
          >
            <Download class="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>

