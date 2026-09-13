<script setup>
import { X, ChevronDown, ChevronLeft, ChevronRight } from '../../icons'
import EventListItem from './EventListItem.vue'
import EventBandHeader from './EventBandHeader.vue'
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
</script>

<template>
  <!-- A panel dressed as the calendar is, for the same reason the day panel
       is: on a phone it takes the calendar's place. -->
  <div
    v-if="show"
    ref="dialogRef"
    role="dialog"
    aria-labelledby="month-events-drawer-title"
    tabindex="-1"
    class="flex h-full w-full shrink-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 lg:ml-3 lg:w-[calc(50%-0.75rem)]"
  >
    <div class="flex shrink-0 items-center gap-1 border-b border-gray-200 px-1.5 py-1.5 dark:border-gray-700 sm:px-2">
      <!-- Month navigator, the same three controls as the calendar's strip -->
      <div class="relative flex min-w-0 items-center">
        <button
          @click="emit('navigateMonth', 'prev')"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 active:scale-95 dark:text-gray-400 dark:hover:bg-gray-700"
          aria-label="Previous month"
        >
          <ChevronLeft class="h-5 w-5" />
        </button>

        <button
          @click="toggleMonthPicker"
          class="flex h-9 w-40 items-center justify-center gap-1 rounded-lg px-1 transition-colors hover:bg-gray-100 md:w-52 dark:hover:bg-gray-700"
          aria-label="Choose month"
          :aria-expanded="showMonthPicker"
        >
          <span
            id="month-events-drawer-title"
            class="truncate text-base font-semibold text-gray-900 md:text-lg dark:text-white"
          >
            {{ currentMonth }}
          </span>
          <ChevronDown
            :class="['h-4 w-4 shrink-0 text-gray-400 transition-transform', showMonthPicker ? 'rotate-180' : '']"
          />
        </button>

        <button
          @click="emit('navigateMonth', 'next')"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 active:scale-95 dark:text-gray-400 dark:hover:bg-gray-700"
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

          <!-- The month on screen is filled; the real current month is only
               outlined, in the same colour, so "where am I" and "where is now"
               read as two degrees of one thing rather than two accents. -->
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
                  ? 'text-primary ring-1 ring-inset ring-primary/40 hover:bg-primary/10'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
              ]"
            >
              {{ name }}
            </button>
          </div>

          <button
            @click="goToCurrentMonth"
            class="mt-2 h-9 w-full rounded-lg text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            This month
          </button>
        </div>
      </div>

      <button
        @click="$emit('update:show', false)"
        aria-label="Close"
        class="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
      >
        <X class="h-5 w-5" />
      </button>
    </div>

    <!-- Extra bottom padding so the floating button never covers the last
         event -->
    <div class="min-h-0 flex-1 overflow-y-auto pb-20">
      <div v-if="loading" class="space-y-1 p-2">
        <EventCardSkeleton v-for="i in 5" :key="i" />
      </div>
      <div
        v-else-if="sortedEvents.length === 0"
        class="p-8 text-center text-sm text-gray-500 dark:text-gray-400"
      >
        <p v-if="searching">Nothing in this month matches your search</p>
        <p v-else>No events scheduled for this month</p>
      </div>
      <template v-else>
        <!-- Done folds away, collapsed by default: this list is mostly for
             looking ahead. Headed the way the People list heads an age band,
             so the two sections read as sections rather than as a divider
             line in a colour of its own. -->
        <section v-if="pastEvents.length > 0">
          <EventBandHeader
            clickable
            label="Done"
            :count="pastEvents.length"
            :aria-expanded="showDoneEvents"
            @click="showDoneEvents = !showDoneEvents"
          >
            <ChevronDown
              :class="['h-4 w-4 text-gray-400 transition-transform', showDoneEvents ? 'rotate-180' : '']"
            />
          </EventBandHeader>
          <div v-show="showDoneEvents" class="space-y-1 p-2">
            <EventListItem
              v-for="event in pastEvents"
              :key="event.id"
              :event="event"
              leading="date"
              past
              @click="$emit('eventClick', event)"
            />
          </div>
        </section>

        <section v-if="upcomingEvents.length > 0">
          <EventBandHeader label="Upcoming" :count="upcomingEvents.length" highlight />
          <div class="space-y-1 p-2">
            <EventListItem
              v-for="event in upcomingEvents"
              :key="event.id"
              :event="event"
              leading="date"
              :today="isToday(event.date)"
              @click="$emit('eventClick', event)"
            />
          </div>
        </section>
      </template>
    </div>
  </div>
</template>
