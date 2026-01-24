<script setup>
import { X, Calendar, Users, Filter } from 'lucide-vue-next'

defineProps({
  showFilters: {
    type: Boolean,
    default: false
  },
  dateFilter: {
    type: String,
    default: null
  },
  eventTypeFilter: {
    type: String,
    default: null
  },
  memberFilter: {
    type: String,
    default: null
  },
  eventTypes: {
    type: Array,
    default: () => []
  },
  members: {
    type: Array,
    default: () => []
  },
  hasActiveFilters: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'update:showFilters',
  'update:dateFilter',
  'update:eventTypeFilter',
  'update:memberFilter',
  'clearFilters'
])

</script>

<template>
  <Transition name="drawer">
    <div
      v-if="showFilters"
      class="filter-drawer border-l-4 border-[#01779b] bg-gray-50 dark:bg-gray-900 w-1/2 h-full flex flex-col flex-shrink-0 shadow-2xl shadow-[#01779b]/20"
    >
      <!-- Header -->
      <div class="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Filter class="h-5 w-5" />
          Filters
        </h3>
        <button
          @click="$emit('update:showFilters', false)"
          class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto min-h-0 p-6">
        <div class="space-y-6">
          <!-- Clear Filters -->
          <div v-if="hasActiveFilters" class="flex justify-end">
            <button
              @click="$emit('clearFilters')"
              class="text-sm text-[#01779b] hover:text-[#015a77] flex items-center gap-1"
            >
              <X class="h-4 w-4" />
              Clear all filters
            </button>
          </div>

          <!-- Date Filter -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <Calendar class="h-4 w-4" />
              Date
            </label>
            <input
              :value="dateFilter"
              @input="$emit('update:dateFilter', $event.target.value || null)"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
            />
          </div>

          <!-- Event Type Filter -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Event Type
            </label>
            <select
              :value="eventTypeFilter"
              @change="$emit('update:eventTypeFilter', $event.target.value || null)"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
            >
              <option value="">All Types</option>
              <option v-for="type in eventTypes" :key="type" :value="type">
                {{ type.charAt(0).toUpperCase() + type.slice(1) }}
              </option>
            </select>
          </div>

          <!-- Member Filter -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <Users class="h-4 w-4" />
              Member
            </label>
            <select
              :value="memberFilter"
              @change="$emit('update:memberFilter', $event.target.value || null)"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
            >
              <option value="">All Members</option>
              <option v-for="member in members" :key="member.id || member.firestoreId" :value="member.id || member.firestoreId">
                {{ `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Unknown' }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: max-width 0.3s ease-out, opacity 0.3s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
}
</style>

