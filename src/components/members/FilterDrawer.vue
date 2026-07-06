<script setup>
import { ref, watch } from "vue";
import { X, ArrowUp, ArrowDown, Filter, RotateCcw } from "lucide-vue-next";

const props = defineProps({
  showFilters: {
    type: Boolean,
    default: false,
  },
  filters: {
    type: Object,
    required: true,
  },
  allTags: {
    type: Array,
    default: () => [],
  },
  hasActiveFilters: {
    type: Boolean,
    default: false,
  },
  sortBy: {
    type: String,
    default: "name",
  },
  sortOrder: {
    type: String,
    default: "asc",
  },
});

const emit = defineEmits([
  "update:showFilters",
  "update:sortBy",
  "update:sortOrder",
  "applyFilters",
  "clearFilters",
]);

// Local copy of filters - changes here don't affect parent until Apply is clicked
const localFilters = ref({ ...props.filters });
const localSortBy = ref(props.sortBy);
const localSortOrder = ref(props.sortOrder);

// Sync local state when drawer opens
watch(() => props.showFilters, (isOpen) => {
  if (isOpen) {
    localFilters.value = { ...props.filters, tags: [...(props.filters.tags || [])] };
    localSortBy.value = props.sortBy;
    localSortOrder.value = props.sortOrder;
  }
});

// Check if local filters have changes
const hasLocalChanges = ref(false);
watch([localFilters, localSortBy, localSortOrder], () => {
  hasLocalChanges.value = true;
}, { deep: true });

// Apply filters
const applyFilters = () => {
  emit('update:sortBy', localSortBy.value);
  emit('update:sortOrder', localSortOrder.value);
  emit('applyFilters', { ...localFilters.value });
  emit('update:showFilters', false);
};

// Clear all local filters (just resets form)
const clearLocalFilters = () => {
  localFilters.value = {
    tags: [],
    isMember: null,
    sex: null,
    civilStatus: null,
    hasAddress: null,
    hasOccupation: null,
  };
  localSortBy.value = 'name';
  localSortOrder.value = 'asc';
};

// Clear and apply immediately
const clearAndApply = () => {
  clearLocalFilters();
  emit('update:sortBy', 'name');
  emit('update:sortOrder', 'asc');
  emit('clearFilters');
  emit('update:showFilters', false);
};

// Toggle tag in local filters
const toggleLocalTag = (tag) => {
  const index = localFilters.value.tags.indexOf(tag);
  if (index > -1) {
    localFilters.value.tags.splice(index, 1);
  } else {
    localFilters.value.tags.push(tag);
  }
};

// Check if local filters are active
const hasLocalActiveFilters = () => {
  return (
    localFilters.value.tags.length > 0 ||
    localFilters.value.isMember !== null ||
    localFilters.value.sex !== null ||
    localFilters.value.civilStatus !== null ||
    localFilters.value.hasAddress !== null ||
    localFilters.value.hasOccupation !== null ||
    localSortBy.value !== 'name' ||
    localSortOrder.value !== 'asc'
  );
};
</script>

<template>
  <Transition name="drawer">
    <div
      v-if="showFilters"
      class="filter-drawer m-3 rounded-2xl border-2 border-primary/30 dark:border-primary-light/30 bg-white dark:bg-gray-800 w-[calc(50%-1.5rem)] h-[calc(100%-1.5rem)] flex flex-col shrink-0 shadow-xl shadow-primary/25 dark:shadow-primary-light/20"
    >
      <!-- Header -->
      <div class="shrink-0 bg-linear-to-r from-primary/10 to-transparent dark:from-primary-light/10 dark:to-transparent rounded-t-2xl border-b border-primary/20 dark:border-primary-light/20 px-5 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-primary/10 dark:bg-primary-light/10 rounded-lg">
              <Filter class="h-5 w-5 text-primary dark:text-primary-light" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Filters</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400">Refine your search</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="hasLocalActiveFilters() || hasActiveFilters"
              @click="clearAndApply"
              class="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw class="h-3.5 w-3.5" />
              Clear
            </button>
            <button
              @click="$emit('update:showFilters', false)"
              class="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X class="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <!-- Scrollable Content -->
      <div class="flex-1 overflow-y-auto p-5 space-y-6">
        
        <!-- Sort Section -->
        <section class="space-y-3">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">Sort</h4>
          
          <!-- Sort By + Order on same line -->
          <div class="flex items-center gap-2">
            <div class="flex flex-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                v-for="option in [
                  { value: 'name', label: 'Name' },
                  { value: 'age', label: 'Age' },
                  { value: 'dateOfBirth', label: 'Birthday' }
                ]"
                :key="option.value"
                @click="localSortBy = option.value"
                :class="[
                  'flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all',
                  localSortBy === option.value
                    ? 'bg-primary dark:bg-primary-light text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                ]"
              >
                {{ option.label }}
              </button>
            </div>
            
            <!-- Sort Order Toggle -->
            <button
              @click="localSortOrder = localSortOrder === 'asc' ? 'desc' : 'asc'"
              class="flex items-center gap-1.5 px-3 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <component :is="localSortOrder === 'asc' ? ArrowUp : ArrowDown" class="h-4 w-4 text-primary dark:text-primary-light" />
              {{ localSortBy === 'age' || localSortBy === 'dateOfBirth' 
                ? (localSortOrder === 'asc' ? 'Youngest' : 'Oldest') 
                : (localSortOrder === 'asc' ? 'A→Z' : 'Z→A') }}
            </button>
          </div>
        </section>

        <!-- Membership Section -->
        <section class="space-y-3">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">Membership</h4>
          <div class="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              v-for="option in [
                { value: null, label: 'All' },
                { value: true, label: 'Members' },
                { value: false, label: 'Non-Members' }
              ]"
              :key="String(option.value)"
              @click="localFilters.isMember = option.value"
              :class="[
                'flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all',
                localFilters.isMember === option.value
                  ? 'bg-primary dark:bg-primary-light text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              ]"
            >
              {{ option.label }}
            </button>
          </div>
        </section>

        <!-- Demographics Section -->
        <section class="space-y-4">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">Demographics</h4>
          
          <!-- Gender -->
          <div class="space-y-2">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Gender</p>
            <div class="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                v-for="option in [
                  { value: null, label: 'All' },
                  { value: 'Male', label: '♂ Male' },
                  { value: 'Female', label: '♀ Female' }
                ]"
                :key="String(option.value)"
                @click="localFilters.sex = option.value"
                :class="[
                  'flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all',
                  localFilters.sex === option.value
                    ? 'bg-primary dark:bg-primary-light text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                ]"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
          
          <!-- Civil Status -->
          <div class="space-y-2">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Civil Status</p>
            <div class="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                v-for="option in [
                  { value: null, label: 'All' },
                  { value: 'Single', label: 'Single' },
                  { value: 'Married', label: 'Married' },
                  { value: 'Separated', label: 'Separated' }
                ]"
                :key="String(option.value)"
                @click="localFilters.civilStatus = option.value"
                :class="[
                  'flex-1 px-2 py-2 text-sm font-medium rounded-md transition-all',
                  localFilters.civilStatus === option.value
                    ? 'bg-primary dark:bg-primary-light text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                ]"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
        </section>

        <!-- Additional Info Section -->
        <section class="space-y-4">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">Additional Info</h4>
          
          <!-- Address -->
          <div class="space-y-2">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Address</p>
            <div class="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                v-for="option in [
                  { value: null, label: 'All' },
                  { value: true, label: 'Has Address' },
                  { value: false, label: 'No Address' }
                ]"
                :key="String(option.value)"
                @click="localFilters.hasAddress = option.value"
                :class="[
                  'flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all',
                  localFilters.hasAddress === option.value
                    ? 'bg-primary dark:bg-primary-light text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                ]"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
          
          <!-- Occupation -->
          <div class="space-y-2">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Occupation</p>
            <div class="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                v-for="option in [
                  { value: null, label: 'All' },
                  { value: true, label: 'Has Job' },
                  { value: false, label: 'No Job' }
                ]"
                :key="String(option.value)"
                @click="localFilters.hasOccupation = option.value"
                :class="[
                  'flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all',
                  localFilters.hasOccupation === option.value
                    ? 'bg-primary dark:bg-primary-light text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                ]"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
        </section>

        <!-- Tags Section -->
        <section v-if="allTags.length > 0" class="space-y-3">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">Ministry Tags</h4>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="tag in allTags"
              :key="tag"
              @click="toggleLocalTag(tag)"
              :class="[
                'px-3 py-1.5 text-sm font-medium rounded-full transition-all border',
                localFilters.tags.includes(tag)
                  ? 'bg-primary dark:bg-primary-light text-white border-transparent'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-primary dark:hover:border-primary-light'
              ]"
            >
              {{ tag }}
            </button>
          </div>
        </section>
      </div>

      <!-- Footer -->
      <div class="shrink-0 bg-linear-to-r from-primary/10 to-transparent dark:from-primary-light/10 dark:to-transparent rounded-b-2xl border-t border-primary/20 dark:border-primary-light/20 px-5 py-4">
        <div class="flex gap-3">
          <button
            @click="$emit('update:showFilters', false)"
            class="flex-1 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            @click="applyFilters"
            class="flex-1 px-4 py-3 text-sm font-semibold text-white bg-primary dark:bg-primary-light rounded-xl hover:bg-primary-hover dark:hover:bg-[#1a9aab] transition-colors shadow-lg shadow-primary/25 dark:shadow-primary-light/25"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style>
.filter-drawer {
  transition: max-width 0.3s ease-out, opacity 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}

.drawer-enter-from.filter-drawer,
.drawer-leave-to.filter-drawer {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
}
</style>
