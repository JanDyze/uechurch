<script setup>
import { X, ArrowUpDown, Users } from "lucide-vue-next";

defineProps({
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
  groupByFamily: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  "update:showFilters",
  "update:sortBy",
  "update:sortOrder",
  "update:groupByFamily",
  "clearFilters",
  "toggleTag",
]);
</script>

<template>
  <Transition name="drawer">
    <div
      v-if="showFilters"
      class="filter-drawer border-l-4 border-[#01779b] bg-gray-50 dark:bg-gray-900 max-w-xl w-[28rem] h-full flex flex-col flex-shrink-0 shadow-2xl shadow-[#01779b]/20"
    >
      <!-- Header -->
      <div class="flex-shrink-0 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          Filter Members
        </h3>
        <div class="flex items-center gap-3">
          <button
            v-if="hasActiveFilters"
            @click="$emit('clearFilters')"
            class="text-sm text-[#01779b] dark:text-[#01779b] hover:underline flex items-center gap-1"
          >
            <X class="h-4 w-4" />
            Clear all
          </button>
          <button
            @click="$emit('update:showFilters', false)"
            class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X class="h-5 w-5" />
          </button>
        </div>
      </div>

      <!-- Scrollable Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <div class="space-y-4">
          <!-- Sort Options -->
          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sort By
            </label>
            <div class="space-y-3">
              <div class="relative">
                <select
                  :value="sortBy"
                  @change="$emit('update:sortBy', $event.target.value)"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#01779b] focus:border-transparent cursor-pointer"
                >
                  <option value="name">Name</option>
                  <option value="age">Age</option>
                  <option value="dateOfBirth">Birth Date</option>
                </select>
              </div>
              <button
                @click="$emit('update:sortOrder', sortOrder === 'asc' ? 'desc' : 'asc')"
                class="w-full flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                :title="sortOrder === 'asc' ? 'Ascending (A-Z, 0-9)' : 'Descending (Z-A, 9-0)'"
              >
                <ArrowUpDown class="h-4 w-4" />
                <span>{{ sortOrder === 'asc' ? 'Ascending' : 'Descending' }}</span>
              </button>
            </div>
          </div>

          <div class="border-t border-gray-200 dark:border-gray-700"></div>

          <!-- Tags Filter -->
          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tags
            </label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="tag in allTags"
                :key="tag"
                @click="$emit('toggleTag', tag)"
                :class="[
                  'px-3 py-1 text-xs rounded-full transition-colors',
                  filters.tags.includes(tag)
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
                @click="filters.isMember = null"
                :class="[
                  'px-3 py-1 text-xs rounded-lg transition-colors',
                  filters.isMember === null
                    ? 'bg-[#01779b] text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                ]"
              >
                All
              </button>
              <button
                @click="filters.isMember = true"
                :class="[
                  'px-3 py-1 text-xs rounded-lg transition-colors',
                  filters.isMember === true
                    ? 'bg-[#01779b] text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                ]"
              >
                Members
              </button>
              <button
                @click="filters.isMember = false"
                :class="[
                  'px-3 py-1 text-xs rounded-lg transition-colors',
                  filters.isMember === false
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
                @click="filters.sex = null"
                :class="[
                  'px-3 py-1 text-xs rounded-lg transition-colors',
                  filters.sex === null
                    ? 'bg-[#01779b] text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                ]"
              >
                All
              </button>
              <button
                @click="filters.sex = 'Male'"
                :class="[
                  'px-3 py-1 text-xs rounded-lg transition-colors',
                  filters.sex === 'Male'
                    ? 'bg-[#01779b] text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                ]"
              >
                Male
              </button>
              <button
                @click="filters.sex = 'Female'"
                :class="[
                  'px-3 py-1 text-xs rounded-lg transition-colors',
                  filters.sex === 'Female'
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
                @click="filters.civilStatus = null"
                :class="[
                  'px-3 py-1 text-xs rounded-lg transition-colors',
                  filters.civilStatus === null
                    ? 'bg-[#01779b] text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                ]"
              >
                All
              </button>
              <button
                @click="filters.civilStatus = 'Single'"
                :class="[
                  'px-3 py-1 text-xs rounded-lg transition-colors',
                  filters.civilStatus === 'Single'
                    ? 'bg-[#01779b] text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                ]"
              >
                Single
              </button>
              <button
                @click="filters.civilStatus = 'Married'"
                :class="[
                  'px-3 py-1 text-xs rounded-lg transition-colors',
                  filters.civilStatus === 'Married'
                    ? 'bg-[#01779b] text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                ]"
              >
                Married
              </button>
              <button
                @click="filters.civilStatus = 'Divorced'"
                :class="[
                  'px-3 py-1 text-xs rounded-lg transition-colors',
                  filters.civilStatus === 'Divorced'
                    ? 'bg-[#01779b] text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                ]"
              >
                Divorced
              </button>
            </div>
          </div>

          <div class="border-t border-gray-200 dark:border-gray-700"></div>

          <!-- Group by Family Button -->
          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              View Options
            </label>
            <button
              @click="$emit('update:groupByFamily', !groupByFamily)"
              :class="[
                'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                groupByFamily
                  ? 'bg-[#01779b] text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
              ]"
            >
              <Users class="h-4 w-4" />
              <span>{{ groupByFamily ? 'Grouped by Family' : 'Group by Family' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Sticky Footer -->
      <div class="flex-shrink-0 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
        <button
          @click="$emit('update:showFilters', false)"
          class="w-full px-4 py-2 text-sm font-medium text-white bg-[#01779b] dark:bg-[#01779b] rounded-lg hover:bg-[#015a77] dark:hover:bg-[#015a77] transition-colors"
        >
          Apply
        </button>
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

