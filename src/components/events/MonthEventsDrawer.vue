<script setup>
import { Clock, MapPin, Users, X, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, Check } from 'lucide-vue-next'
import * as LucideIcons from 'lucide-vue-next'
import EventCardSkeleton from './EventCardSkeleton.vue'
import { computed, ref } from 'vue'
import eventTypesData from '../../data/eventTypes.json'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  monthEvents: {
    type: Array,
    default: () => []
  },
  currentMonth: {
    type: String,
    default: ''
  },
  eventTypeFilter: {
    type: Array,
    default: () => []
  },
  sortBy: {
    type: String,
    default: 'date'
  },
  sortOrder: {
    type: String,
    default: 'asc'
  }
})

const eventTypes = eventTypesData

const emit = defineEmits([
  'update:show',
  'update:eventTypeFilter',
  'update:sortBy',
  'update:sortOrder',
  'eventClick'
])

// Type filter dropdown state
const showTypeDropdown = ref(false)

// Done section accordion state (collapsed by default)
const showDoneEvents = ref(false)

const toggleTypeFilter = (type) => {
  const currentFilters = [...props.eventTypeFilter]
  const index = currentFilters.indexOf(type)
  if (index === -1) {
    currentFilters.push(type)
  } else {
    currentFilters.splice(index, 1)
  }
  emit('update:eventTypeFilter', currentFilters)
}

const clearTypeFilters = () => {
  emit('update:eventTypeFilter', [])
}

const selectAllTypes = () => {
  emit('update:eventTypeFilter', [...eventTypes])
}

const filterButtonLabel = computed(() => {
  if (props.eventTypeFilter.length === 0) return 'All Types'
  if (props.eventTypeFilter.length === 1) return props.eventTypeFilter[0].charAt(0).toUpperCase() + props.eventTypeFilter[0].slice(1)
  return `${props.eventTypeFilter.length} types`
})

// Filter and sort events
const filteredAndSortedEvents = computed(() => {
  let filtered = props.monthEvents

  // Apply type filter (multi-select)
  if (props.eventTypeFilter.length > 0) {
    filtered = filtered.filter((event) => props.eventTypeFilter.includes(event.type))
  }

  // Apply sorting
  const sorted = [...filtered].sort((a, b) => {
    let comparison = 0

    switch (props.sortBy) {
      case 'date':
        const dateA = new Date(a.date)
        const dateB = new Date(b.date)
        comparison = dateA.getTime() - dateB.getTime()
        // If same date, sort by time
        if (comparison === 0) {
          comparison = (a.time || '').localeCompare(b.time || '')
        }
        break
      case 'time':
        comparison = (a.time || '').localeCompare(b.time || '')
        // If same time, sort by date
        if (comparison === 0) {
          const dateA = new Date(a.date)
          const dateB = new Date(b.date)
          comparison = dateA.getTime() - dateB.getTime()
        }
        break
      case 'title':
        comparison = (a.title || '').localeCompare(b.title || '')
        break
      case 'type':
        comparison = (a.type || '').localeCompare(b.type || '')
        break
      default:
        comparison = 0
    }

    return props.sortOrder === 'asc' ? comparison : -comparison
  })

  return sorted
})

const getEventTypeColor = (type, isPast = false) => {
  if (isPast) {
    return 'bg-gray-400 text-white'
  }
  const colors = {
    worship: 'bg-blue-500 text-white',
    prayer: 'bg-purple-500 text-white',
    meeting: 'bg-slate-500 text-white',
    fellowship: 'bg-teal-500 text-white',
    outreach: 'bg-orange-500 text-white',
    training: 'bg-green-500 text-white',
    celebration: 'bg-pink-500 text-white',
    special: 'bg-amber-500 text-white',
  }
  return colors[type] || 'bg-gray-500 text-white'
}

const getIconComponent = (iconName) => {
  return LucideIcons[iconName] || LucideIcons.Calendar
}

// Date helpers
const today = new Date()
today.setHours(0, 0, 0, 0)

const isToday = (dateStr) => {
  const eventDate = new Date(dateStr)
  eventDate.setHours(0, 0, 0, 0)
  return eventDate.getTime() === today.getTime()
}

const isPastEvent = (dateStr) => {
  const eventDate = new Date(dateStr)
  eventDate.setHours(0, 0, 0, 0)
  return eventDate.getTime() < today.getTime()
}

// Split events into past and upcoming
const pastEvents = computed(() => {
  return filteredAndSortedEvents.value.filter(e => isPastEvent(e.date))
})

const upcomingEvents = computed(() => {
  return filteredAndSortedEvents.value.filter(e => !isPastEvent(e.date))
})
</script>

<template>
  <div
    v-if="show"
    class="m-3 rounded-2xl border-2 border-[#01779b]/30 dark:border-[#22b8cf]/30 bg-white dark:bg-gray-800 w-[calc(50%-1.5rem)] h-[calc(100%-1.5rem)] flex flex-col flex-shrink-0 shadow-xl shadow-[#01779b]/25 dark:shadow-[#22b8cf]/20"
  >
    <!-- Header -->
    <div class="shrink-0 bg-gradient-to-r from-[#01779b]/10 to-transparent dark:from-[#22b8cf]/10 dark:to-transparent rounded-t-2xl border-b border-[#01779b]/20 dark:border-[#22b8cf]/20 px-5 py-4">
      <div class="flex items-start justify-between mb-4">
        <div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ currentMonth }}</h2>
          <p class="text-sm text-[#01779b] dark:text-[#22b8cf] font-medium mt-0.5">Events</p>
        </div>
        <button
          @click="$emit('update:show', false)"
          class="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <!-- Filter and Sort Options -->
      <div class="grid grid-cols-2 gap-3">
        <!-- Event Type Filter (Multi-select dropdown) -->
        <div class="relative">
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Filter by Type
          </label>
          <button
            @click="showTypeDropdown = !showTypeDropdown"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center justify-between"
          >
            <span :class="eventTypeFilter.length === 0 ? 'text-gray-500' : ''">{{ filterButtonLabel }}</span>
            <ChevronDown :class="['h-4 w-4 transition-transform', showTypeDropdown ? 'rotate-180' : '']" />
          </button>
          
          <!-- Dropdown Menu -->
          <div
            v-if="showTypeDropdown"
            class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 py-1 max-h-64 overflow-y-auto"
          >
            <!-- Quick actions -->
            <div class="flex items-center gap-1 px-2 py-1.5 border-b border-gray-200 dark:border-gray-700">
              <button
                @click="selectAllTypes"
                class="flex-1 text-xs px-2 py-1 rounded text-[#01779b] dark:text-[#22b8cf] hover:bg-[#01779b]/10 dark:hover:bg-[#22b8cf]/10 transition-colors"
              >
                Select All
              </button>
              <button
                @click="clearTypeFilters"
                class="flex-1 text-xs px-2 py-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Clear
              </button>
            </div>
            
            <!-- Type options -->
            <button
              v-for="type in eventTypes"
              :key="type"
              @click="toggleTypeFilter(type)"
              class="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
            >
              <div
                :class="[
                  'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                  eventTypeFilter.includes(type)
                    ? 'bg-[#01779b] dark:bg-[#22b8cf] border-[#01779b] dark:border-[#22b8cf]'
                    : 'border-gray-300 dark:border-gray-600'
                ]"
              >
                <Check v-if="eventTypeFilter.includes(type)" class="h-3 w-3 text-white" />
              </div>
              <span class="text-gray-900 dark:text-white">{{ type.charAt(0).toUpperCase() + type.slice(1) }}</span>
            </button>
          </div>
          
          <!-- Click outside to close -->
          <div
            v-if="showTypeDropdown"
            @click="showTypeDropdown = false"
            class="fixed inset-0 z-40"
          ></div>
        </div>

        <!-- Sort Options -->
        <div>
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Sort by
          </label>
          <div class="flex items-center gap-2">
            <select
              :value="sortBy"
              @change="$emit('update:sortBy', $event.target.value)"
              class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
            >
              <option value="date">Date</option>
              <option value="time">Time</option>
              <option value="title">Title</option>
              <option value="type">Type</option>
            </select>
            <button
              @click="$emit('update:sortOrder', sortOrder === 'asc' ? 'desc' : 'asc')"
              class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center justify-center"
              :title="sortOrder === 'asc' ? 'Ascending' : 'Descending'"
            >
              <ArrowUp v-if="sortOrder === 'asc'" class="h-4 w-4" />
              <ArrowDown v-else class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-4">
      <div v-if="loading" class="space-y-3">
        <EventCardSkeleton v-for="i in 5" :key="i" />
      </div>
      <div
        v-else-if="filteredAndSortedEvents.length === 0"
        class="text-center text-gray-500 dark:text-gray-400 py-8"
      >
        <p v-if="monthEvents.length === 0">No events scheduled for this month</p>
        <p v-else>No events match the current filter</p>
      </div>
      <template v-else>
        <!-- Past Events (collapsible accordion) -->
        <div v-if="pastEvents.length > 0" class="mb-4">
          <!-- Accordion Header -->
          <button
            @click="showDoneEvents = !showDoneEvents"
            class="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <span class="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
              Done
              <span class="text-gray-300 dark:text-gray-500">({{ pastEvents.length }})</span>
            </span>
            <ChevronDown
              :class="[
                'h-4 w-4 text-gray-400 transition-transform',
                showDoneEvents ? 'rotate-180' : ''
              ]"
            />
          </button>
          <!-- Accordion Content -->
          <div
            v-show="showDoneEvents"
            class="space-y-2 mt-2"
          >
            <button
              v-for="event in pastEvents"
              :key="event.id"
              @click="$emit('eventClick', event)"
              class="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors bg-gray-100 dark:bg-gray-800 opacity-60"
            >
              <div class="flex items-start gap-3">
                <div
                  :class="[
                    'w-14 h-14 rounded-lg flex flex-col items-center justify-center shrink-0',
                    getEventTypeColor(event.type, true),
                  ]"
                >
                  <span class="text-xl font-bold leading-none">{{ new Date(event.date).getDate() }}</span>
                  <span class="text-[10px] uppercase tracking-wide opacity-90">{{ new Date(event.date).toLocaleDateString('en-US', { weekday: 'short' }) }}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="font-medium text-sm text-gray-500 dark:text-gray-400 truncate">
                    {{ event.title }}
                  </h3>
                  <div class="flex items-center gap-2 mt-1 text-xs text-gray-400 dark:text-gray-500 flex-wrap">
                    <span>{{ event.time }}</span>
                    <span v-if="event.location" class="flex items-center gap-1">
                      <span>•</span>
                      <MapPin class="h-3 w-3" />
                      <span class="truncate">{{ event.location }}</span>
                    </span>
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>

        <!-- Divider -->
        <div v-if="pastEvents.length > 0 && upcomingEvents.length > 0" class="flex items-center gap-3 my-4">
          <div class="flex-1 h-px bg-amber-400 dark:bg-amber-500"></div>
          <span class="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Upcoming</span>
          <div class="flex-1 h-px bg-amber-400 dark:bg-amber-500"></div>
        </div>

        <!-- Upcoming Events -->
        <div v-if="upcomingEvents.length > 0" class="space-y-2">
          <button
            v-for="event in upcomingEvents"
            :key="event.id"
            @click="$emit('eventClick', event)"
            :class="[
              'w-full text-left p-3 rounded-lg border transition-colors',
              isToday(event.date)
                ? 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/20 ring-2 ring-amber-400/50 dark:ring-amber-500/50'
                : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
            ]"
          >
            <div class="flex items-start gap-3">
              <div
                :class="[
                  'w-14 h-14 rounded-lg flex flex-col items-center justify-center shrink-0',
                  isToday(event.date) ? 'ring-2 ring-amber-400 dark:ring-amber-500' : '',
                  getEventTypeColor(event.type),
                ]"
              >
                <span class="text-xl font-bold leading-none">{{ new Date(event.date).getDate() }}</span>
                <span class="text-[10px] uppercase tracking-wide opacity-90">{{ new Date(event.date).toLocaleDateString('en-US', { weekday: 'short' }) }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <h3 class="font-medium text-sm text-gray-900 dark:text-white truncate">
                    {{ event.title }}
                  </h3>
                  <span v-if="isToday(event.date)" class="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-amber-500 text-white rounded">Today</span>
                </div>
                <div class="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                  <span>{{ event.time }}</span>
                  <span v-if="event.location" class="flex items-center gap-1">
                    <span>•</span>
                    <MapPin class="h-3 w-3" />
                    <span class="truncate">{{ event.location }}</span>
                  </span>
                </div>
              </div>
            </div>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
