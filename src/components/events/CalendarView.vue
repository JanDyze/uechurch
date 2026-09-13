<script setup>
import { ref, computed } from 'vue'
import { ChevronDown, ChevronLeft, ChevronRight, List, LayoutGrid } from '../../icons'
import { getEventIcon as getIconComponent, iconForEvent } from '../../utils/eventIcons'
import {
  getEventTypeColor,
  getEventTypeDot,
  CALLED_OFF_OUTLINE,
  CALLED_OFF_TEXT,
} from '../../utils/eventColors'
import { isCalledOff, eventStatusSummary } from '../../../lib/eventStatus'
import EventListItem from './EventListItem.vue'
import EventBandHeader from './EventBandHeader.vue'
import EventCardSkeleton from './EventCardSkeleton.vue'
import philippineHolidays from '../../data/philippineHolidays.json'
import { useMediaQuery } from '../../composables/useMediaQuery'
import { useFocusTrap } from '../../composables/useFocusTrap'
import { useSwipePage } from '../../composables/useSwipePage'

const props = defineProps({
  currentDate: {
    type: Date,
    required: true
  },
  currentMonth: {
    type: String,
    required: true
  },
  calendarDays: {
    type: Array,
    required: true
  },
  selectedDate: {
    type: String,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  },
  events: {
    type: Array,
    default: () => []
  },
  calendarScrollRef: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['navigateMonth', 'dayClick', 'eventClick', 'goToToday', 'calendarWheel', 'setDate'])

// Swipe to turn the month, the way the wheel already does on a desktop. The
// arrows stay: a gesture nobody is told about cannot be the only way to do
// something.
//
// Both axes in the grid, which scrolls in neither direction. The agenda keeps
// sideways only — its up and down belong to the list it is scrolling.
const { swipeRef } = useSwipePage({
  axis: () => (showAgendaView.value ? 'horizontal' : 'both'),
  onNext: () => emit('navigateMonth', 'next'),
  onPrevious: () => emit('navigateMonth', 'prev'),
})

// The grid needs both the parent's scroll ref and the gesture's, and an
// element takes one `ref`. This hands the node to each of them.
const gridRef = (el) => {
  swipeRef(el)
  if (props.calendarScrollRef) props.calendarScrollRef.value = el
}

// On narrow phone screens, show fewer events per day so the ones shown stay readable
const isCompact = useMediaQuery('(max-width: 639px)')

// How many weeks this month actually occupies — five for most, six for a long
// month that starts late, four for a February beginning on a Sunday. The rows
// are declared from this rather than fixed at six, or a five-week month would
// leave an empty band at the bottom and squash every cell to make room for it.
const weekCount = computed(() => Math.max(1, Math.ceil(props.calendarDays.length / 7)))

/**
 * The grid is the default at every size, phones included.
 *
 * This used to switch itself to the agenda list below 640px, on the reasoning
 * that a six-row month is hard to scan on a phone. In practice the grid is the
 * thing people come to a calendar for — where a date falls in the week, which
 * days are free — and being given a list instead meant the grid was something
 * you had to go and find on a device where most of the looking happens.
 *
 * The toggle is still in the header, and the choice is now remembered per
 * device rather than reset on every visit, so whoever does prefer the list
 * only has to say so once.
 */
const AGENDA_KEY = 'uec.events.agendaView'
const readAgendaPreference = () => {
  try {
    return localStorage.getItem(AGENDA_KEY) === '1'
  } catch {
    return false
  }
}

const showAgendaView = ref(readAgendaPreference())
const toggleAgendaView = () => {
  showAgendaView.value = !showAgendaView.value
  try {
    localStorage.setItem(AGENDA_KEY, showAgendaView.value ? '1' : '0')
  } catch {
    /* the preference lasts the session */
  }
}

// Month/Year picker state
const showMonthYearPicker = ref(false)
const monthYearPickerRef = ref(null)
const closeMonthYearPicker = () => { showMonthYearPicker.value = false }
useFocusTrap(monthYearPickerRef, showMonthYearPicker, closeMonthYearPicker)

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const currentYear = computed(() => props.currentDate.getFullYear())
const currentMonthIndex = computed(() => props.currentDate.getMonth())

// Generate year range (10 years before and after current year)
const years = computed(() => {
  const thisYear = new Date().getFullYear()
  const range = []
  for (let y = thisYear - 10; y <= thisYear + 10; y++) {
    range.push(y)
  }
  return range
})

const selectMonth = (monthIndex) => {
  emit('setDate', new Date(currentYear.value, monthIndex, 1))
  showMonthYearPicker.value = false
}

const selectYear = (year) => {
  emit('setDate', new Date(year, currentMonthIndex.value, 1))
}

const holidays = philippineHolidays

/**
 * Events and holidays indexed by date, and every cell resolved once.
 *
 * The template used to call getEventsForDate(day) around twenty times per
 * cell — for the count, for the first event, for the second, for each of the
 * conditions in between — and each call filtered the whole events array. Over
 * a 35-cell grid that is several hundred full scans on every render, and the
 * markup that came out of it could not be read: the same expression repeated
 * so often that conditions like `(!holiday && n > 1) || (holiday && n > 1)`
 * went unnoticed for what they are, which is `n > 1`.
 *
 * One pass here, one plain object per cell, and the template only reads.
 */
const holidaysByDate = computed(() => {
  const map = new Map()
  for (const holiday of holidays) map.set(holiday.date, holiday)
  return map
})

const eventsByDate = computed(() => {
  const map = new Map()
  for (const event of props.events || []) {
    if (!event?.date) continue
    const list = map.get(event.date)
    if (list) list.push(event)
    else map.set(event.date, [event])
  }
  return map
})

/**
 * How many events a cell shows before it starts counting the rest.
 *
 * Three at both widths. On a phone they are overlapping discs, and the overlap
 * buys back more width than a third disc costs; wider they are stacked chips
 * with room for their titles.
 */
const CHIP_LIMIT = 3

const dayCells = computed(() =>
  props.calendarDays.map((day) => {
    const dateString = formatDateString(day.fullDate)
    const dayEvents = eventsByDate.value.get(dateString) || []
    const holiday = holidaysByDate.value.get(dateString) || null
    // Three discs fit across a phone cell. Where a fourth event exists the
    // third disc becomes the counter instead, so the cluster is never more
    // than three wide — the way a stack of faces ends in "+2".
    //
    // On a wider cell a holiday costs an event its place, because there the
    // name is written out and takes a row. On a phone the holiday is a mark
    // beside the date and takes nothing from the cluster below it.
    const limit = isCompact.value
      ? (dayEvents.length <= 3 ? 3 : 2)
      : Math.max(1, CHIP_LIMIT - (holiday ? 1 : 0))
    return {
      day,
      dateString,
      holiday,
      events: dayEvents,
      shown: dayEvents.slice(0, limit),
      // Only ever the events not on screen. The old "+N" counted differently
      // depending on whether there was a holiday, and was right by accident.
      overflow: Math.max(0, dayEvents.length - limit),
      isToday: isToday(day.fullDate),
      isSelected: props.selectedDate === dateString,
    }
  })
)

const formatDateString = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const isToday = (date) => {
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

// Kept for the agenda view and the aria labels, but reading the same indexes
// rather than scanning the arrays again.
const getHolidayForDate = (date) => holidaysByDate.value.get(formatDateString(date)) || undefined

const getEventsForDate = (date) => eventsByDate.value.get(formatDateString(date)) || []

// Days in the current month that have a holiday or an event, in date order, for the agenda view
const agendaDays = computed(() => {
  return props.calendarDays
    .filter((day) => day.isCurrentMonth)
    .map((day) => ({
      day,
      dateString: formatDateString(day.fullDate),
      holiday: getHolidayForDate(day.fullDate),
      events: getEventsForDate(day.fullDate),
    }))
    .filter((entry) => entry.holiday || entry.events.length > 0)
})

// Short enough to share a strip with a count and a holiday on a phone.
const agendaHeading = (day) =>
  day.fullDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

const getDayAriaLabel = (day) => {
  const parts = [
    day.fullDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
  ]
  if (isToday(day.fullDate)) parts.push('Today')
  const holiday = getHolidayForDate(day.fullDate)
  if (holiday) parts.push(holiday.name)
  const dayEvents = getEventsForDate(day.fullDate)
  if (dayEvents.length) parts.push(`${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`)
  if (props.selectedDate === formatDateString(day.fullDate)) parts.push('Selected')
  return parts.join(', ')
}

// Day cells wrap nested event buttons, so Enter/Space should only trigger
// dayClick when the cell itself (not a nested button) has focus.
const handleDayKeydown = (event, day) => {
  if (event.target !== event.currentTarget) return
  event.preventDefault()
  emit('dayClick', day)
}
</script>

<template>
  <div class="h-full flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
    <!-- One slim strip, the way the People list has one: month on the left,
         the view and Today on the right. It was a 72px bar with a filled Today
         pill, which on a phone is height the grid's six weeks need more. -->
    <div class="flex shrink-0 items-center gap-1 border-b border-gray-200 px-1.5 py-1.5 dark:border-gray-700 sm:px-2">
      <div class="flex min-w-0 items-center">
        <button
          @click="emit('navigateMonth', 'prev')"
          aria-label="Previous month"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 active:scale-95 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <ChevronLeft class="h-5 w-5" />
        </button>

        <!-- A fixed width, so the arrows either side stay under the thumb
             while somebody taps through several months in a row. -->
        <div class="relative">
          <button
            @click="showMonthYearPicker = !showMonthYearPicker"
            aria-haspopup="dialog"
            :aria-expanded="showMonthYearPicker"
            class="flex h-9 w-40 items-center justify-center gap-1 rounded-lg px-1 text-base font-semibold text-gray-900 transition-colors hover:bg-gray-100 md:w-52 md:text-lg dark:text-white dark:hover:bg-gray-700"
          >
            <span class="truncate">{{ currentMonth }}</span>
            <ChevronDown
              :class="['h-4 w-4 shrink-0 text-gray-400 transition-transform', showMonthYearPicker ? 'rotate-180' : '']"
            />
          </button>

          <!-- Month/Year Picker Dropdown -->
          <div
            v-if="showMonthYearPicker"
            ref="monthYearPickerRef"
            role="dialog"
            aria-modal="true"
            aria-label="Choose month and year"
            tabindex="-1"
            class="absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 z-50 w-72 max-w-[calc(100vw-2rem)] sm:left-1/2 sm:-translate-x-1/2"
          >
            <!-- Year Selector -->
            <div class="mb-4">
              <p id="calendar-year-label" class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Year</p>
              <div class="flex items-center gap-2">
                <button
                  @click="selectYear(currentYear - 1)"
                  aria-label="Previous year"
                  class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronLeft class="h-4 w-4 text-gray-600 dark:text-gray-300" />
                </button>
                <select
                  :value="currentYear"
                  @change="selectYear(Number($event.target.value))"
                  aria-labelledby="calendar-year-label"
                  class="flex-1 px-3 py-2 text-center font-semibold bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
                </select>
                <button
                  @click="selectYear(currentYear + 1)"
                  aria-label="Next year"
                  class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronRight class="h-4 w-4 text-gray-600 dark:text-gray-300" />
                </button>
              </div>
            </div>

            <!-- Month Grid -->
            <div>
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Month</p>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="(month, index) in months"
                  :key="month"
                  @click="selectMonth(index)"
                  :aria-label="month"
                  :aria-pressed="currentMonthIndex === index"
                  :class="[
                    'px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                    currentMonthIndex === index
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  ]"
                >
                  {{ month.slice(0, 3) }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <button
          @click="emit('navigateMonth', 'next')"
          aria-label="Next month"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 active:scale-95 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <ChevronRight class="h-5 w-5" />
        </button>
      </div>
      <div class="ml-auto flex shrink-0 items-center gap-0.5">
        <button
          @click="toggleAgendaView"
          :aria-pressed="showAgendaView"
          :aria-label="showAgendaView ? 'Switch to grid view' : 'Switch to agenda view'"
          :title="showAgendaView ? 'Grid view' : 'Agenda view'"
          class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <LayoutGrid v-if="showAgendaView" class="h-5 w-5" />
          <List v-else class="h-5 w-5" />
        </button>
        <!-- Text in the primary colour rather than a filled pill: it is a
             jump, not the page's main action, and the floating button already
             holds that. -->
        <button
          @click="emit('goToToday')"
          class="inline-flex h-9 items-center rounded-lg px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          Today
        </button>
      </div>
    </div>

    <!-- Click outside to close picker -->
    <div
      v-if="showMonthYearPicker"
      @click="showMonthYearPicker = false"
      aria-hidden="true"
      class="fixed inset-0 z-40"
    ></div>

    <!-- Agenda View: default on narrow/short screens where a month grid is hard to scan -->
    <!-- The agenda swipes between months too. A gesture that works in one of
         two views and silently does nothing in the other reads as broken; the
         vertical-scroll guard in useSwipePage keeps this list scrolling. -->
    <div v-if="showAgendaView" :ref="swipeRef" class="flex-1 overflow-y-auto pb-20 min-h-0">
      <div v-if="loading" aria-hidden="true" class="space-y-1 p-2">
        <EventCardSkeleton v-for="i in 6" :key="`agenda-skeleton-${i}`" />
      </div>
      <!-- Laid out the way the People list is: a sticky heading for each day
           and plain rows beneath it. It was a bordered card per day holding
           filled chips, which made a busy month a wall of colour. The heading
           still opens the day. -->
      <Transition v-else name="calendar-month" mode="out-in">
        <div :key="currentMonth" role="list" :aria-label="`${currentMonth} agenda`">
          <section
            v-for="entry in agendaDays"
            :key="entry.dateString"
            role="listitem"
          >
            <EventBandHeader
              clickable
              :label="agendaHeading(entry.day)"
              :count="entry.events.length || null"
              :note="entry.holiday?.name || ''"
              :highlight="isToday(entry.day.fullDate) || selectedDate === entry.dateString"
              :aria-label="getDayAriaLabel(entry.day)"
              :aria-current="isToday(entry.day.fullDate) ? 'date' : undefined"
              @click="emit('dayClick', entry.day)"
            >
              <span
                v-if="isToday(entry.day.fullDate)"
                class="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase text-white"
              >
                Today
              </span>
            </EventBandHeader>
            <div v-if="entry.events.length" class="space-y-1 p-2">
              <EventListItem
                v-for="event in entry.events"
                :key="event.id"
                :event="event"
                :title="eventStatusSummary(event) || event.title"
                @click="emit('eventClick', event)"
              />
            </div>
          </section>

          <div v-if="!agendaDays.length" class="text-center text-sm text-gray-500 dark:text-gray-400 py-10">
            No events scheduled for {{ currentMonth }}
          </div>
        </div>
      </Transition>
    </div>

    <!-- Calendar Grid -->
    <div v-else :ref="gridRef" @wheel="emit('calendarWheel', $event)" class="flex-1 flex flex-col p-2 md:p-4 min-h-0">
      <!-- Day Headers -->
      <div class="grid grid-cols-7 gap-1 md:gap-1.5 mb-1 md:mb-2 shrink-0">
        <div
          v-for="day in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']"
          :key="day"
          class="p-1 md:p-2 text-center text-[10px] md:text-xs font-semibold text-gray-500 dark:text-gray-400"
        >
          {{ day }}
        </div>
      </div>

      <!-- Calendar Days with transition -->
      <Transition name="calendar-month" mode="out-in">
        <div v-if="loading" :key="`skeleton-${currentMonth}`" aria-hidden="true" :style="{ gridTemplateRows: `repeat(${weekCount}, minmax(0, 1fr))` }" class="calendar-grid flex-1 grid grid-cols-7 gap-1.5 min-h-0">
          <div
            v-for="i in weekCount * 7"
            :key="`skeleton-day-${i}`"
            class="min-h-0 p-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden"
          >
            <div class="h-4 w-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse mb-1"></div>
            <div class="h-3 w-full bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
          </div>
        </div>
        <div v-else :key="currentMonth" role="group" :aria-label="`${currentMonth} calendar`" :style="{ gridTemplateRows: `repeat(${weekCount}, minmax(0, 1fr))` }" class="calendar-grid flex-1 grid grid-cols-7 gap-1 md:gap-1.5 min-h-0">
            <div
              v-for="(cell, index) in dayCells"
              :key="index"
              role="button"
              tabindex="0"
              :aria-label="getDayAriaLabel(cell.day)"
              :aria-current="cell.isToday ? 'date' : undefined"
              :aria-pressed="cell.isSelected ? 'true' : undefined"
              @click="emit('dayClick', cell.day)"
              @keydown.enter="handleDayKeydown($event, cell.day)"
              @keydown.space="handleDayKeydown($event, cell.day)"
              :class="[
                'min-h-0 p-1 md:p-1.5 rounded-lg transition-colors cursor-pointer overflow-hidden flex flex-col',
                // A ring rather than a 2px border on the states that mark a
                // day out: a border changes the box, so today's cell used to
                // sit a pixel off from its neighbours and the whole row looked
                // misaligned. A ring is drawn on top and costs no layout.
                //
                // Primary for both today and the selected day, the one accent
                // the People page uses for this-one: today is a tint and a
                // filled date, selected is the ring. Today was amber, and with
                // yellow holidays and amber Off badges beside it the page
                // had three warm colours meaning three unrelated things.
                // Holidays keep only their dot — a yellow edge on the cell was
                // a fourth border colour for the eye to decode.
                cell.day.isCurrentMonth
                  ? cell.isSelected
                    ? 'bg-primary/10 dark:bg-primary/20 ring-2 ring-primary ring-inset border border-transparent'
                    : cell.isToday
                    ? 'bg-primary/5 dark:bg-primary/10 border border-primary/30 hover:bg-primary/10'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                : 'bg-gray-50/60 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800/50',
              ]"
            >
            <!-- Day number, with the holiday's mark beside it rather than
                 below. The holiday used to take a whole row of the cell and
                 push the events out; it is a property of the day, so it
                 belongs on the day's own line. -->
            <div class="mb-0.5 flex items-center justify-between gap-1 md:mb-1">
              <span
                :class="[
                  'text-xs font-medium leading-none md:text-sm',
                  cell.isToday && cell.day.isCurrentMonth
                    ? '-m-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary font-bold text-white md:h-6 md:w-6'
                    : cell.day.isCurrentMonth
                    ? 'text-gray-900 dark:text-white'
                    : 'text-gray-400 dark:text-gray-600',
                ]"
              >
                {{ cell.day.date }}
              </span>
              <span
                v-if="cell.holiday"
                class="h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500"
                :title="cell.holiday.name"
              ></span>
            </div>

            <!-- The holiday's name, where there is width for it. Quiet text
                 rather than a filled block: it is not something you can open,
                 so it should not look like the chips that are. -->
            <p
              v-if="cell.holiday && !isCompact"
              class="mb-0.5 truncate text-[10px] leading-tight text-yellow-700 dark:text-yellow-500"
              :title="cell.holiday.name"
            >
              {{ cell.holiday.name }}
            </p>
            <!-- Phones: overlapping dots, the way a group of faces is stacked.
                 Filled squares with a glyph inside were too much furniture at
                 16px — six of them in a week read as a row of buttons rather
                 than as a week. Overlapping costs less width than it saves, so
                 three still fit, and the cluster reads as one answer to "how
                 busy is this day" instead of three separate marks.

                 Not tappable, deliberately: a 10px disc is not a target, and
                 the whole cell already opens the day. -->
            <div
              v-if="isCompact && cell.events.length"
              class="flex min-h-0 flex-1 items-center justify-center"
            >
              <span class="flex items-center">
                <span
                  v-for="(event, position) in cell.shown"
                  :key="event.id"
                  :title="eventStatusSummary(event) || event.title"
                  :class="[
                    // The ring is the cell showing through, which is what makes
                    // the discs read as separate where they overlap.
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-2 ring-white dark:ring-gray-800',
                    position > 0 ? '-ml-2.5' : '',
                    // Hollow, not faded. Dimming a filled disc muddies its
                    // colour against the cell and reads as a rendering fault
                    // rather than as a decision; an outline reads as absence,
                    // which is what a called-off gathering is. It drops its
                    // type colour with its fill — what kind of thing is not
                    // happening matters less than that it is not. The dashes
                    // are red, the colour a called-off gathering carries on
                    // every screen, so the disc is legible without its title.
                    isCalledOff(event)
                      ? `border-2 bg-white dark:bg-gray-800 ${CALLED_OFF_OUTLINE} ${CALLED_OFF_TEXT}`
                      : `text-white ${getEventTypeDot(event.type)}`,
                  ]"
                >
                  <!-- Back now the disc is 20px: a 12px glyph sits inside it
                       with room to breathe, where at 10px there was nothing to
                       put an icon in. The colour still carries the type, so the
                       glyph is white and only has to say which kind. -->
                  <component :is="getIconComponent(iconForEvent(event))" class="h-3 w-3" />
                </span>
                <!-- The rest, as the last disc rather than as text beside the
                     cluster: it belongs to the stack, and a loose number was
                     the untidiest thing in the cell. -->
                <span
                  v-if="cell.overflow"
                  :title="`${cell.overflow} more`"
                  class="-ml-2.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-400 text-[9px] font-bold leading-none text-white ring-2 ring-white dark:bg-gray-500 dark:ring-gray-800"
                >
                  +{{ cell.overflow }}
                </span>
              </span>
            </div>

            <!-- Wider: the same events with room for their names. -->
            <div v-else-if="cell.events.length" class="flex min-h-0 flex-1 flex-col gap-0.5" @click.stop>
              <button
                v-for="event in cell.shown"
                :key="event.id"
                @click.stop="emit('eventClick', event)"
                :title="eventStatusSummary(event) || event.title"
                :class="[
                  'flex w-full shrink-0 items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] leading-tight transition-opacity hover:opacity-80 sm:px-1.5 sm:text-xs',
                  // Outlined rather than dimmed, the same reasoning as the
                  // discs: a 60% chip sits between two legible states and
                  // looks like neither. Red edge, grey struck-through title:
                  // the edge says what happened, the title stays quiet.
                  isCalledOff(event)
                    ? `border text-gray-500 dark:text-gray-400 ${CALLED_OFF_OUTLINE}`
                    : getEventTypeColor(event.type),
                ]"
              >
                <component :is="getIconComponent(iconForEvent(event))" class="h-3 w-3 shrink-0" />
                <span :class="['truncate', isCalledOff(event) ? 'line-through' : '']">{{ event.title }}</span>
              </button>

              <!-- A note about the cell, not another thing to press. -->
              <span
                v-if="cell.overflow"
                class="shrink-0 px-1 text-[10px] font-semibold leading-tight text-gray-500 sm:px-1.5 dark:text-gray-400"
              >
                +{{ cell.overflow }} more
              </span>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.calendar-grid {
  /* Ensure grid fills available space */
  height: 100%;
}

.calendar-month-enter-active,
.calendar-month-leave-active {
  transition: all 0.25s ease-out;
}

.calendar-month-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.calendar-month-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>

