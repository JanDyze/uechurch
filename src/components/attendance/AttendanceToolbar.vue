<script setup>
import { Search, Filter, Plus } from 'lucide-vue-next'

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
  }
})

const emit = defineEmits([
  'update:searchQuery',
  'update:showFilters',
  'toggle-record-attendance'
])
</script>

<template>
  <div class="sticky top-0 z-40 mb-4 flex-shrink-0 flex items-center gap-2 bg-white dark:bg-gray-900 py-2">
    <div class="relative flex-1">
      <Search
        class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400"
      />
      <input
        :value="searchQuery"
        @input="emit('update:searchQuery', $event.target.value)"
        type="text"
        placeholder="Search..."
        class="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
      />
    </div>

    <!-- Filter Toggle -->
    <button
      @click="emit('update:showFilters', !showFilters)"
      :class="[
        'p-2 rounded-lg transition-colors relative',
        showFilters || hasActiveFilters
          ? 'bg-[#01779b] dark:bg-[#22b8cf] text-white'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
      ]"
    >
      <Filter class="h-5 w-5" />
      <span
        v-if="hasActiveFilters"
        class="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full"
      ></span>
    </button>

    <!-- Record Attendance Button -->
    <button
      @click="emit('toggle-record-attendance')"
      :class="[
        'p-2 rounded-lg transition-all',
        showRecordAttendance
          ? 'bg-[#015a77] dark:bg-[#1ca3b8] text-white'
          : 'bg-[#01779b] dark:bg-[#22b8cf] text-white hover:bg-[#015a77] dark:hover:bg-[#1ca3b8]'
      ]"
    >
      <Plus 
        :class="[
          'h-5 w-5 transition-transform duration-200',
          showRecordAttendance ? 'rotate-45' : ''
        ]"
      />
    </button>
  </div>
</template>

