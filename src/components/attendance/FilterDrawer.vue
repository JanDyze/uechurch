<script setup>
import { ref } from 'vue'
import { X, Calendar, Users, Filter } from '../../icons'
import { useMediaQuery } from '../../composables/useMediaQuery'
import { useFocusTrap } from '../../composables/useFocusTrap'

const isMobile = useMediaQuery('(max-width: 1023px)')

const props = defineProps({
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
  },
  showNotRecorded: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits([
  'update:showFilters',
  'update:dateFilter',
  'update:eventTypeFilter',
  'update:memberFilter',
  'update:showNotRecorded',
  'clearFilters'
])

const dialogRef = ref(null)
useFocusTrap(dialogRef, () => props.showFilters, () => emit('update:showFilters', false))

</script>

<template>
  <Teleport to="body" :disabled="!isMobile">
    <Transition :name="isMobile ? 'modal-sheet' : 'drawer'">
    <div
      v-if="showFilters"
      :class="[
        isMobile
          ? 'fixed inset-0 z-80 flex flex-col justify-end'
          : 'filter-drawer border-l-4 border-primary bg-gray-50 dark:bg-gray-900 w-1/2 h-full flex flex-col shrink-0 shadow-2xl shadow-primary/20'
      ]"
    >
      <div
        v-if="isMobile"
        class="absolute inset-0 bg-black/50"
        @click="$emit('update:showFilters', false)"
      />
      <div
        ref="dialogRef"
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-filter-drawer-title"
        tabindex="-1"
        :class="[
          'flex flex-col min-h-0',
          isMobile
            ? 'relative z-10 w-full max-h-[92dvh] rounded-t-2xl bg-gray-50 dark:bg-gray-900 shadow-2xl border-t border-gray-200 dark:border-gray-700'
            : 'h-full w-full'
        ]"
      >
      <!-- Header -->
      <div class="shrink-0 rounded-t-2xl bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 flex items-center justify-between">
        <h3 id="attendance-filter-drawer-title" class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Filter class="h-5 w-5" />
          Filters
        </h3>
        <button
          @click="$emit('update:showFilters', false)"
          aria-label="Close"
          class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6">
        <div class="space-y-6">
          <!-- Clear Filters -->
          <div v-if="hasActiveFilters" class="flex justify-end">
            <button
              @click="$emit('clearFilters')"
              class="text-sm text-primary hover:text-primary-hover flex items-center gap-1"
            >
              <X class="h-4 w-4" />
              Clear all filters
            </button>
          </div>

          <!-- Not-recorded events/meetings -->
          <div class="flex items-center justify-between gap-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
                Show not recorded
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Past events and meetings with no attendance taken
              </p>
            </div>
            <button
              @click="$emit('update:showNotRecorded', !showNotRecorded)"
              :class="[
                'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
                showNotRecorded ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
              ]"
              role="switch"
              :aria-checked="showNotRecorded"
              aria-label="Show events and meetings with no attendance recorded"
            >
              <span
                :class="[
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  showNotRecorded ? 'translate-x-6' : 'translate-x-1'
                ]"
              ></span>
            </button>
          </div>

          <!-- Date Filter -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 items-center gap-2">
              <Calendar class="h-4 w-4" />
              Date
            </label>
            <input
              :value="dateFilter"
              @input="$emit('update:dateFilter', $event.target.value || null)"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
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
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">All Types</option>
              <option v-for="type in eventTypes" :key="type" :value="type">
                {{ type.charAt(0).toUpperCase() + type.slice(1) }}
              </option>
            </select>
          </div>

          <!-- Member Filter -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 items-center gap-2">
              <Users class="h-4 w-4" />
              Member
            </label>
            <select
              :value="memberFilter"
              @change="$emit('update:memberFilter', $event.target.value || null)"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
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
    </div>
    </Transition>
  </Teleport>
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

.modal-sheet-enter-active,
.modal-sheet-leave-active {
  transition: opacity 0.25s ease;
}

.modal-sheet-enter-active > div:last-child,
.modal-sheet-leave-active > div:last-child {
  transition: transform 0.25s ease;
}

.modal-sheet-enter-from,
.modal-sheet-leave-to {
  opacity: 0;
}

.modal-sheet-enter-from > div:last-child,
.modal-sheet-leave-to > div:last-child {
  transform: translateY(100%);
}
</style>

