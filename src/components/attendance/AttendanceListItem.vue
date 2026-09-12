<script setup>
import { computed } from 'vue'
import {
  getEventTypeBar,
  getEventTypeColor,
  getEventTypeText,
  eventTypeLabel,
} from '../../utils/eventColors'
import { isCalledOff, eventStatusLabel, readEventStatus } from '../../../lib/eventStatus'
import { CalendarClock } from '../../icons'

const props = defineProps({
  record: {
    type: Object,
    required: true
  },
  members: {
    type: Array,
    default: () => []
  },
  selected: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['delete', 'record-attendance', 'edit-attendance', 'mark', 'click'])

const handleClick = () => {
  // A gathering that is off, or one nobody is counting, has nothing to record:
  // opening the marker is the only useful thing a tap can do, and it is also
  // the way back — reinstating it, or asking to be prompted again.
  if (calledOff.value || props.record.skipped) {
    emit('mark', props.record)
    return
  }
  if (props.record.rowType === 'attendance') {
    emit('edit-attendance', props.record)
  } else if (
    props.record.rowType === 'event' ||
    props.record.rowType === 'minute' ||
    props.record.rowType === 'recurring'
  ) {
    emit('record-attendance', props.record)
  } else {
    emit('click', props.record)
  }
}

const getDay = (dateString) => {
  if (!dateString) return '--'
  return new Date(dateString).getDate()
}

const getDayName = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('en-US', { weekday: 'short' })
}

// The calendar's vocabulary, so a Sunday service is the same blue here as it
// is on Events and a meeting the same slate. A meeting arrives as a minute row
// rather than a typed event, so it is named rather than guessed.
const type = computed(() =>
  props.record.rowType === 'minute' ? 'meeting' : props.record.eventType || ''
)

const category = computed(() => (type.value ? eventTypeLabel(type.value) : 'Event'))

// Rows synthesised from an event/meeting that has no saved attendance behind
// it yet. Nothing is stored, so there is nothing to open in edit mode or
// delete - they are prompts, not records.
const isPlaceholder = computed(() => props.record.rowType !== 'attendance')

// Cancelled or postponed on the calendar. The row stays — a service that is
// off is a fact about that Sunday, and hiding it is how somebody ends up
// recording attendance for a gathering that never happened.
const calledOff = computed(() => isCalledOff(props.record))
const statusLabel = computed(() => eventStatusLabel(readEventStatus(props.record)))

// Deliberately not counted anywhere: a skipped gathering is not a turnout of
// zero, it is a decision not to count.
const skipped = computed(() => Boolean(props.record.skipped))

/** Off, skipped, or simply not yet done — the three things a row can be. */
const isQuiet = computed(() => calledOff.value || skipped.value)

// Only a meeting cannot be called off: minutes are not the calendar's to
// cancel, and a gathering already recorded is history rather than a plan.
const canMark = computed(
  () => props.record.rowType === 'event' || props.record.rowType === 'recurring' || isPlaceholder.value
)

const roster = computed(() => props.members.length)

const present = computed(() => props.record.totalAttendees ?? props.record.attendees?.length ?? 0)

// Who was expected, not who is on the roster. A choir practice is for the ten
// people carrying the tag, and reporting "8 of 105" called a full turnout a
// collapse. The count arrives already recounted off the gathering's tags
// (useAttendance.js); the roster only stands in for something that names no
// audience at all, where everyone genuinely is the answer.
const expected = computed(() => props.record.expectedAttendees || roster.value)

// The same denominator the recorder counts against on its own header, so the
// two screens cannot disagree about the same gathering.
const share = computed(() => {
  if (isPlaceholder.value || skipped.value || !expected.value) return null
  return Math.min(100, Math.round((present.value / expected.value) * 100))
})
</script>

<template>
  <div
    @click="handleClick"
    :class="[
      'relative flex cursor-pointer select-none items-center gap-3 overflow-hidden px-4 py-3 transition-colors',
      selected
        ? 'bg-primary/10 dark:bg-primary/20'
        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50',
      // Still there, still readable, plainly not part of the count.
      isQuiet ? 'opacity-60' : '',
    ]"
  >
    <!-- The row itself is the gauge: it fills from the left in proportion to
         turnout, so a full house and a thin one are told apart down the list
         without reading a single number. In the gathering's own colour, so the
         list is sorted by kind at a glance as well as by size. -->
    <div
      v-if="share !== null"
      :class="[
        'pointer-events-none absolute inset-y-0 left-0 opacity-20 transition-[width] duration-700 ease-out dark:opacity-30',
        getEventTypeBar(type),
      ]"
      :style="{ width: `${share}%` }"
    ></div>

    <!-- The stripe carries the colour even on a row with nothing recorded, so
         a month of services still reads as a month of services. -->
    <div
      :class="[
        'pointer-events-none absolute inset-y-0 left-0 w-1',
        getEventTypeBar(type),
        isPlaceholder ? 'opacity-30' : '',
      ]"
    ></div>

    <!-- Big Day Display -->
    <div class="relative w-12 shrink-0 text-center">
      <div class="text-2xl font-bold leading-none text-gray-900 dark:text-white">
        {{ getDay(record.date) }}
      </div>
      <div class="mt-0.5 text-xs uppercase text-gray-400 dark:text-gray-500">
        {{ getDayName(record.date) }}
      </div>
    </div>

    <div class="relative min-w-0 flex-1">
      <p
        :class="[
          'truncate text-sm font-medium',
          calledOff
            ? 'text-gray-500 line-through dark:text-gray-400'
            : 'text-gray-900 dark:text-white',
        ]"
      >
        {{ record.eventTitle || 'Untitled' }}
      </p>
      <div class="mt-0.5 flex items-center gap-2">
        <span
          :class="[
            'rounded px-1.5 py-0.5 text-xs',
            getEventTypeColor(type),
            isPlaceholder ? 'opacity-60' : '',
          ]"
        >
          {{ category }}
        </span>
        <!-- Cancelled and postponed are facts about the gathering; skipped is
             a decision about the paperwork. Three different states, so three
             different words rather than one grey badge for all of them. -->
        <span
          v-if="calledOff"
          class="rounded bg-amber-500 px-1.5 py-0.5 text-xs font-semibold text-white"
        >
          {{ statusLabel }}
        </span>
        <span
          v-else-if="skipped"
          class="rounded border border-dashed border-gray-300 px-1.5 py-0.5 text-xs text-gray-400 dark:border-gray-600 dark:text-gray-500"
        >
          Not counted
        </span>
        <span v-else-if="!isPlaceholder" class="text-xs text-gray-500 dark:text-gray-400">
          <span class="tabular-nums">{{ present }}</span>
          <span v-if="expected"> of <span class="tabular-nums">{{ expected }}</span></span>
        </span>
        <span
          v-else
          class="rounded border border-dashed border-gray-300 px-1.5 py-0.5 text-xs text-gray-400 dark:border-gray-600 dark:text-gray-500"
        >
          Not recorded
        </span>
      </div>

      <p
        v-if="record.statusNote || record.postponedTo"
        class="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400"
      >
        <template v-if="record.postponedTo">Moved to {{ record.postponedTo }}</template>
        <template v-if="record.postponedTo && record.statusNote"> · </template>
        {{ record.statusNote }}
      </p>
    </div>

    <!-- The way to say "this one is not happening" without leaving the list.
         A tap target of its own, because the row itself already means
         "record this". -->
    <button
      v-if="canMark && !isQuiet"
      @click.stop="emit('mark', record)"
      aria-label="Cancel, postpone or skip"
      title="Cancel, postpone or skip"
      class="relative shrink-0 rounded-lg p-2 text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-500 dark:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
    >
      <CalendarClock class="h-4 w-4" />
    </button>

    <p
      v-if="share !== null"
      :class="['relative shrink-0 text-xl font-bold tabular-nums', getEventTypeText(type)]"
    >
      {{ share }}<span class="text-sm font-semibold">%</span>
    </p>
  </div>
</template>
