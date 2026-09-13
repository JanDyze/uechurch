<script setup>
import { computed } from 'vue'
import { MapPin } from '../../icons'
import { getEventIcon as getIconComponent, iconForEvent } from '../../utils/eventIcons'
import {
  getEventTypeColor,
  CALLED_OFF_BADGE,
  CALLED_OFF_OUTLINE,
  CALLED_OFF_TEXT,
} from '../../utils/eventColors'
import { isCalledOff, eventStatusLabel, readEventStatus } from '../../../lib/eventStatus'

// One event, one row, wherever a list of them appears on the Events page — the
// agenda, a day, the month list. Each of those used to draw its own card, with
// its own padding, border and idea of what "today" looked like, so the same
// Sunday service changed shape depending on which way you had come to it.
//
// The shape is the People list's row: a tile where the avatar would be, the
// title, one quiet line under it. Everything else is one tap away in details.

const props = defineProps({
  event: {
    type: Object,
    required: true,
  },
  // What the tile says. 'icon' when the day is already the heading above the
  // row; 'date' when the row has to carry its own day, as in the month list.
  leading: {
    type: String,
    default: 'icon',
  },
  // Already happened: greyed wholesale, whatever kind of gathering it was.
  past: {
    type: Boolean,
    default: false,
  },
  today: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['click'])

const calledOff = computed(() => isCalledOff(props.event))
const statusLabel = computed(() => eventStatusLabel(readEventStatus(props.event)))

const dayNumber = computed(() => Number(String(props.event.date || '').slice(8, 10)) || '')

// Parsed as local parts, never `new Date('YYYY-MM-DD')`, which is UTC midnight
// and names the day before anywhere west of Greenwich.
const weekday = computed(() => {
  const [year, month, day] = String(props.event.date || '').split('-').map(Number)
  if (!year || !month || !day) return ''
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'short' })
})

// Hollow and red rather than filled with the type colour, the way the
// calendar's discs are: what kind of thing is not happening matters less than
// that it is not.
const tileClass = computed(() => {
  if (calledOff.value) return `border-2 bg-white dark:bg-gray-800 ${CALLED_OFF_OUTLINE} ${CALLED_OFF_TEXT}`
  return getEventTypeColor(props.event.type, props.past)
})
</script>

<template>
  <button
    type="button"
    @click="$emit('click', event)"
    :class="[
      'flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors',
      today
        ? 'bg-primary/10 ring-1 ring-primary/30 dark:bg-primary/20'
        : 'hover:bg-gray-100 dark:hover:bg-gray-700/50',
      past ? 'opacity-60' : '',
    ]"
  >
    <span
      :class="[
        'flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl',
        tileClass,
      ]"
    >
      <template v-if="leading === 'date'">
        <span class="text-base font-bold leading-none tabular-nums">{{ dayNumber }}</span>
        <span class="mt-0.5 text-[9px] font-semibold uppercase tracking-wide opacity-90">{{ weekday }}</span>
      </template>
      <component v-else :is="getIconComponent(iconForEvent(event))" class="h-5 w-5" />
    </span>

    <span class="min-w-0 flex-1">
      <span class="flex min-w-0 items-center gap-1.5">
        <span
          :class="[
            'truncate text-sm font-medium',
            calledOff
              ? 'text-gray-400 line-through dark:text-gray-500'
              : 'text-gray-900 dark:text-white',
          ]"
        >
          {{ event.title }}
        </span>
        <!-- Named, not just struck through: a strike reads as a style until
             something says what it means, and somebody scanning the list needs
             to know whether to turn up. -->
        <span
          v-if="calledOff"
          :class="['shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase', CALLED_OFF_BADGE]"
        >
          {{ statusLabel }}
        </span>
        <span
          v-else-if="today"
          class="shrink-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase text-white"
        >
          Today
        </span>
      </span>

      <!-- One line, whatever there is: time, then place. The reason something
           was called off replaces the place, because it is the more useful of
           the two on a gathering nobody should travel to. -->
      <span class="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        <span v-if="event.time" class="shrink-0 tabular-nums">{{ event.time }}</span>
        <template v-if="calledOff && (event.statusNote || event.postponedTo)">
          <span v-if="event.time" class="shrink-0 text-gray-300 dark:text-gray-600">·</span>
          <span class="truncate">
            <template v-if="event.postponedTo">Moved to {{ event.postponedTo }}</template>
            <template v-if="event.postponedTo && event.statusNote"> · </template>
            {{ event.statusNote }}
          </span>
        </template>
        <template v-else-if="event.location">
          <span v-if="event.time" class="shrink-0 text-gray-300 dark:text-gray-600">·</span>
          <MapPin class="h-3 w-3 shrink-0" />
          <span class="truncate">{{ event.location }}</span>
        </template>
      </span>
    </span>
  </button>
</template>
