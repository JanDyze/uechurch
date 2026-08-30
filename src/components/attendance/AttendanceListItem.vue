<script setup>
import { computed } from 'vue'

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

const emit = defineEmits(['delete', 'record-attendance', 'edit-attendance', 'click'])

const handleClick = () => {
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

const getCategory = () => {
  if (props.record.rowType === 'minute') return 'Meeting'
  if (props.record.eventType) {
    return props.record.eventType.charAt(0).toUpperCase() + props.record.eventType.slice(1)
  }
  return 'Event'
}

// Rows synthesised from an event/meeting that has no saved attendance behind
// it yet. Nothing is stored, so there is nothing to open in edit mode or
// delete - they are prompts, not records.
const isPlaceholder = computed(() => props.record.rowType !== 'attendance')

const roster = computed(() => props.members.length)

const present = computed(() => props.record.totalAttendees ?? props.record.attendees?.length ?? 0)

// The same denominator the recorder counts against on its own header, so the
// two screens cannot disagree about the same gathering.
const share = computed(() => {
  if (isPlaceholder.value || !roster.value) return null
  return Math.min(100, Math.round((present.value / roster.value) * 100))
})
</script>

<template>
  <div
    @click="handleClick"
    :class="[
      'relative flex cursor-pointer select-none items-center gap-3 overflow-hidden px-4 py-3 transition-colors',
      selected
        ? 'bg-primary/10 dark:bg-primary/20'
        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
    ]"
  >
    <!-- The row itself is the gauge: it fills from the left in proportion to
         turnout, so a full house and a thin one are told apart down the list
         without reading a single number. -->
    <div
      v-if="share !== null"
      class="pointer-events-none absolute inset-y-0 left-0 bg-linear-to-r from-primary/20 to-primary/5 transition-[width] duration-700 ease-out dark:from-primary/30 dark:to-primary/10"
      :style="{ width: `${share}%` }"
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
      <p class="truncate text-sm font-medium text-gray-900 dark:text-white">
        {{ record.eventTitle || 'Untitled' }}
      </p>
      <div class="mt-0.5 flex items-center gap-2">
        <span
          class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400"
        >
          {{ getCategory() }}
        </span>
        <span v-if="!isPlaceholder" class="text-xs text-gray-500 dark:text-gray-400">
          <span class="tabular-nums">{{ present }}</span>
          <span v-if="roster"> of <span class="tabular-nums">{{ roster }}</span></span>
        </span>
        <span
          v-else
          class="rounded border border-dashed border-gray-300 px-1.5 py-0.5 text-xs text-gray-400 dark:border-gray-600 dark:text-gray-500"
        >
          Not recorded
        </span>
      </div>
    </div>

    <p
      v-if="share !== null"
      class="relative shrink-0 text-xl font-bold tabular-nums text-primary dark:text-primary-light"
    >
      {{ share }}<span class="text-sm font-semibold">%</span>
    </p>
  </div>
</template>
