<script setup>
import { Search, Filter, Users, BarChart3, Plus } from 'lucide-vue-next'

const props = defineProps({
  searchQuery: {
    type: String,
    default: ''
  },
  showFilters: {
    type: Boolean,
    default: false
  },
  showRecordAttendance: {
    type: Boolean,
    default: false
  },
  hasActiveFilters: {
    type: Boolean,
    default: false
  },
  stats: {
    type: Object,
    default: () => ({
      totalRecords: 0,
      totalAttendees: 0,
      uniqueMembers: 0,
      averageAttendance: 0
    })
  }
})

const emit = defineEmits([
  'update:searchQuery',
  'update:showFilters',
  'toggle-record-attendance'
])
</script>

<template>
  <div class="sticky top-0 z-40 mb-4 flex-shrink-0 flex items-center gap-3 bg-white dark:bg-gray-900 py-2">
    <div class="relative flex-1">
      <Search
        class="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
      />
      <input
        :value="searchQuery"
        @input="emit('update:searchQuery', $event.target.value)"
        type="text"
        placeholder="Search attendance records..."
        class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
      />
    </div>

    <!-- Stats -->
    <div class="hidden md:flex items-center gap-4 px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-2">
        <BarChart3 class="h-4 w-4 text-[#01779b]" />
        <span class="text-sm text-gray-600 dark:text-gray-400">
          <span class="font-semibold text-gray-900 dark:text-white">{{ stats.totalRecords }}</span> records
        </span>
      </div>
      <div class="flex items-center gap-2">
        <Users class="h-4 w-4 text-[#01779b]" />
        <span class="text-sm text-gray-600 dark:text-gray-400">
          <span class="font-semibold text-gray-900 dark:text-white">{{ stats.uniqueMembers }}</span> members
        </span>
      </div>
      <div class="text-sm text-gray-600 dark:text-gray-400">
        Avg: <span class="font-semibold text-gray-900 dark:text-white">{{ stats.averageAttendance }}</span>
      </div>
    </div>

    <!-- Filter Toggle -->
    <button
      @click="emit('update:showFilters', !showFilters)"
      :class="[
        'p-2 rounded-lg transition-colors relative',
        showFilters || hasActiveFilters
          ? 'bg-[#01779b] text-white hover:bg-[#015a77]'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
      ]"
      title="Filter attendance records"
    >
      <Filter class="h-5 w-5" />
      <span
        v-if="hasActiveFilters"
        class="absolute -top-1 -right-1 w-2 h-2 bg-[#bc1c09] rounded-full"
      ></span>
    </button>

    <!-- Record Attendance Button -->
    <button
      @click="emit('toggle-record-attendance')"
      :class="[
        'p-2 rounded-lg transition-all shadow-sm',
        showRecordAttendance
          ? 'bg-[#015a77] text-white hover:bg-[#014a60]'
          : 'bg-[#01779b] text-white hover:bg-[#015a77]'
      ]"
      :title="showRecordAttendance ? 'Close attendance drawer' : 'Record attendance'"
    >
      <Plus 
        :class="[
          'h-5 w-5 transition-transform duration-300',
          showRecordAttendance ? 'rotate-45' : 'rotate-0'
        ]"
      />
    </button>
  </div>
</template>

