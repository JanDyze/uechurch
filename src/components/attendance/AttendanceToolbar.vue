<script setup>
import { ref } from 'vue'
import { Filter, Plus } from 'lucide-vue-next'
import SearchBar from '../common/SearchBar.vue'

const mobileSearchOpen = ref(false)

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
  <div class="sticky top-0 z-40 mb-4 shrink-0 rounded-xl border border-gray-200/80 bg-white/95 px-2 py-2 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 sm:px-3">
    <div class="flex items-center justify-between gap-2 w-full flex-nowrap">
      <SearchBar
        :model-value="searchQuery"
        @update:model-value="emit('update:searchQuery', $event)"
        v-model:open="mobileSearchOpen"
        placeholder="Search..."
      />

      <div :class="['flex items-center gap-1.5 sm:gap-2 flex-nowrap shrink-0 ml-auto', mobileSearchOpen ? 'hidden lg:flex' : 'flex']">
        <!-- Filter Toggle -->
        <button
          @click="emit('update:showFilters', !showFilters)"
          :class="[
            'relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors shrink-0',
            showFilters || hasActiveFilters
              ? 'bg-primary text-white shadow-sm dark:bg-primary'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          ]"
          title="Filter"
        >
          <Filter class="h-5 w-5" />
          <span
            v-if="hasActiveFilters"
            class="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#bc1c09]"
          ></span>
        </button>

        <!-- Record Attendance Button -->
        <button
          @click="emit('toggle-record-attendance')"
          class="flex h-10 items-center justify-center rounded-lg bg-primary text-white shadow-sm transition-colors hover:bg-primary-hover dark:bg-primary dark:hover:bg-primary-hover px-2.5 sm:px-4 gap-1.5 w-10 sm:w-auto shrink-0"
          :class="{ 'bg-primary-hover dark:bg-primary-hover': showRecordAttendance }"
          :title="showRecordAttendance ? 'Close record attendance' : 'Record attendance'"
        >
          <Plus
            class="h-5 w-5 transition-transform duration-200 shrink-0"
            :class="{ 'rotate-45': showRecordAttendance }"
          />
          <span class="hidden sm:inline whitespace-nowrap">Add</span>
        </button>
      </div>
    </div>
  </div>
</template>

