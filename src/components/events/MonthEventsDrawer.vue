<script setup>
import { MapPin, X, ChevronDown, ChevronLeft, ChevronRight } from '../../icons'
import { getEventIcon as getIconComponent } from '../../utils/eventIcons'
import { getEventTypeColor } from '../../utils/eventColors'
import EventCardSkeleton from './EventCardSkeleton.vue'
import { computed, ref } from 'vue'
import { useFocusTrap } from '../../composables/useFocusTrap'

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
  currentDate: {
    type: Date,
    default: () => new Date()
  },
  // Whether the list is already narrowed, so an empty month can say which kind
  // of empty it is rather than claiming nothing was ever scheduled.
  searching: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:show', 'eventClick', 'navigateMonth', 'setDate'])

/* Month navigation - the calendar is hidden on mobile while this card is open,
   so months have to be reachable from here. */
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

const showMonthPicker = ref(false)
const pickerYear = ref(new Date().getFullYear())

const toggleMonthPicker = () => {
  if (!showMonthPicker.value) {
    pickerYear.value = props.currentDate.getFullYear()
  }
  showMonthPicker.value = !showMonthPicker.value
}

const selectMonth = (monthIndex) => {
  emit('setDate', new Date(pickerYear.value, monthIndex, 1))
  showMonthPicker.value = false
}

const goToCurrentMonth = () => {
  const now = new Date()
  emit('setDate', new Date(now.getFullYear(), now.getMonth(), 1))
  showMonthPicker.value = false
}

const isSelectedMonth = (monthIndex) =>
  pickerYear.value === props.currentDate.getFullYear() &&
  monthIndex === props.currentDate.getMonth()

const isCurrentMonth = (monthIndex) => {
  const now = new Date()
  return pickerYear.value === now.getFullYear() && monthIndex === now.getMonth()
}

// Done section accordion state (collapsed by default)
const showDoneEvents = ref(false)

const dialogRef = ref(null)
useFocusTrap(dialogRef, () => props.show, () => emit('update:show', false), { trap: false })

// Date order, ascending, with time breaking a tie. There is no sort control:
// a month reads as a calendar or it reads as nothing, and the toolbar's search
// covers the narrowing the type filter used to do - typing "prayer" or
// "birthday" reaches the same rows with no panel to open.
const sortedEvents = computed(() =>
  [...props.monthEvents].sort(
    (a, b) =>
      String(a.date || '').localeCompare(String(b.date || '')) ||
      String(a.time || '').localeCompare(String(b.time || ''))
  )
)

// Dates are compared as 'YYYY-MM-DD' strings, never parsed: `new Date('2026-08-14')`
// is UTC midnight, which is the 13th anywhere west of Greenwich, and an event
// would file itself under Done a day early. Recomputed rather than captured at
// setup, so a page left open overnight rolls over with the day.
const todayKey = computed(() => {
  void props.monthEvents
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
})

const isToday = (dateStr) => dateStr === todayKey.value

const isPastEvent = (dateStr) => String(dateStr || '') < todayKey.value

// Split events into past and upcoming
const pastEvents = computed(() => sortedEvents.value.filter((e) => isPastEvent(e.date)))

const upcomingEvents = computed(() => sortedEvents.value.filter((e) => !isPastEvent(e.date)))

const dayNumber = (dateStr) => Number(String(dateStr || '').slice(8, 10)) || ''

const weekdayLabel = (dateStr) => {
  const [year, month, day] = String(dateStr || '').split('-').map(Number)
  if (!year || !month || !day) return ''
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'short' })
}
</script>

<template>
  <div
    v-if="show"
    ref="dialogRef"
    role="dialog"
    aria-labelledby="month-events-drawer-title"
    tabindex="-1"
    class="m-0 lg:m-3 rounded-none lg:rounded-2xl border-0 lg:border-2 border-primary/30 dark:border-primary-light/30 bg-white dark:bg-gray-800 w-full lg:w-[calc(50%-1.5rem)] h-full lg:h-[calc(100%-1.5rem)] flex flex-col shrink-0 shadow-none lg:shadow-xl lg:shadow-primary/25 dark:lg:shadow-primary-light/20 transition-all duration-300"
  >
    <!-- Header -->
    <div class="shrink-0 bg-linear-to-r from-primary/10 to-transparent dark:from-primary-light/10 dark:to-transparent lg:rounded-t-2xl border-b border-primary/20 dark:border-primary-light/20 px-4 sm:px-5 py-4">
      <div class="flex items-center justify-between gap-2">
        <!-- Month navigator -->
        <div class="relative flex items-center gap-0.5 min-w-0">
          <button
            @click="emit('navigateMonth', 'prev')"
            class="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active:scale-95"
            aria-label="Previous month"
          >
            <ChevronLeft class="h-5 w-5" />
          </button>

          <button
            @click="toggleMonthPicker"
            class="flex min-w-0 items-center gap-1 rounded-lg px-1.5 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Choose month"
          >
            <span
              id="month-events-drawer-title"
              class="truncate text-lg sm:text-2xl font-bold text-gray-900 dark:text-white"
            >
              {{ currentMonth }}
            </span>
            <ChevronDown
              :class="['h-4 w-4 shrink-0 text-gray-400 transition-transform', showMonthPicker ? 'rotate-180' : '']"
            />
          </button>

          <button
            @click="emit('navigateMonth', 'next')"
            class="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active:scale-95"
            aria-label="Next month"
          >
            <ChevronRight class="h-5 w-5" />
          </button>

          <!-- Month picker -->
          <div
            v-if="showMonthPicker"
            @click="showMonthPicker = false"
            class="fixed inset-0 z-40"
          ></div>
          <div
            v-if="showMonthPicker"
            class="absolute top-full left-0 z-50 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-xl"
          >
            <div class="flex items-center justify-between mb-2">
              <button
                @click="pickerYear--"
                class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Previous year"
              >
                <ChevronLeft class="h-4 w-4" />
              </button>
              <span class="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                {{ pickerYear }}
              </span>
              <button
                @click="pickerYear++"
                class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Next year"
              >
                <ChevronRight class="h-4 w-4" />
              </button>
            </div>

            <div class="grid grid-cols-3 gap-1">
              <button
                v-for="(name, index) in MONTH_NAMES"
                :key="name"
                @click="selectMonth(index)"
                :class="[
                  'h-10 rounded-lg text-xs font-medium transition-colors',
                  isSelectedMonth(index)
                    ? 'bg-primary text-white shadow-sm'
                    : isCurrentMonth(index)
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
                ]"
              >
                {{ name }}
              </button>
            </div>

            <button
              @click="goToCurrentMonth"
              class="mt-2 h-9 w-full rounded-lg bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              This month
            </button>
          </div>
        </div>

        <button
          @click="$emit('update:show', false)"
          aria-label="Close"
          class="shrink-0 p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X class="h-5 w-5" />
        </button>
      </div>
    </div>

    <!-- Content: extra bottom padding so the floating button never covers
         the last event -->
    <div class="flex-1 overflow-y-auto p-4 pb-20">
      <div v-if="loading" class="space-y-3">
        <EventCardSkeleton v-for="i in 5" :key="i" />
      </div>
      <div
        v-else-if="sortedEvents.length === 0"
        class="text-center text-gray-500 dark:text-gray-400 py-8"
      >
        <p v-if="searching">Nothing in this month matches your search</p>
        <p v-else>No events scheduled for this month</p>
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
                  <span class="text-xl font-bold leading-none">{{ dayNumber(event.date) }}</span>
                  <span class="text-[10px] uppercase tracking-wide opacity-90">{{ weekdayLabel(event.date) }}</span>
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
                <span class="text-xl font-bold leading-none">{{ dayNumber(event.date) }}</span>
                <span class="text-[10px] uppercase tracking-wide opacity-90">{{ weekdayLabel(event.date) }}</span>
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
