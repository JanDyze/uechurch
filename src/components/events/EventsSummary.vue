<script setup>
import { computed } from 'vue'
import { CalendarClock, CalendarDays, Calendar } from '../../icons'

const props = defineProps({
  stats: {
    type: Object,
    required: true,
  },
  typeMix: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  // Whether a search is narrowing the report, so an empty month can say which
  // kind of empty it is rather than claiming nothing was ever scheduled.
  searching: {
    type: Boolean,
    default: false,
  },
})

const dash = '—'

// Three questions of the same kind: what is next, how heavy is the week, and
// how full is the month on screen.
const tiles = computed(() => [
  {
    key: 'next',
    icon: CalendarClock,
    label: 'Next',
    value: props.stats.nextLabel || dash,
    hint: props.stats.nextTitle || 'nothing scheduled',
    // "Today" and "Tomorrow" do not shrink the way a number does, so the value
    // drops a size rather than overflowing its column on a phone.
    valueClass: 'text-base sm:text-lg',
  },
  {
    key: 'week',
    icon: CalendarDays,
    label: 'This week',
    value: props.stats.weekCount,
    hint: props.stats.weekCount ? `through ${props.stats.weekEndLabel}` : 'nothing this week',
  },
  {
    key: 'month',
    icon: Calendar,
    // Named rather than "This month": the calendar navigates, and a quiet
    // December read in August would otherwise look like a collapse.
    label: props.stats.monthLabel || 'Month',
    value: props.stats.monthTotal,
    hint: props.stats.monthTotal
      ? `${props.stats.monthDone} done · ${props.stats.monthToCome} to come`
      : 'nothing scheduled',
  },
])

const segmentWidth = (count) =>
  props.stats.monthTotal > 0 ? `${(count / props.stats.monthTotal) * 100}%` : '0%'

const hasMix = computed(() => !props.loading && props.typeMix.length > 0)
</script>

<template>
  <div class="shrink-0 border-b border-gray-200 px-3 py-3 dark:border-gray-700">
    <!-- One row of three so the whole report is readable without scrolling,
         even on a phone. -->
    <div class="grid grid-cols-3 divide-x divide-gray-200 dark:divide-gray-700">
      <div
        v-for="tile in tiles"
        :key="tile.key"
        class="flex min-w-0 flex-col items-center px-1 text-center"
      >
        <div class="flex items-center gap-1 text-gray-400 dark:text-gray-500">
          <component :is="tile.icon" class="h-3 w-3 shrink-0" />
          <span class="truncate text-[10px] font-semibold uppercase tracking-wide">
            {{ tile.label }}
          </span>
        </div>
        <p
          :class="[
            'w-full truncate font-bold tabular-nums text-gray-900 dark:text-white',
            tile.valueClass || 'text-xl sm:text-2xl',
          ]"
        >
          {{ loading ? dash : tile.value }}
        </p>
        <p class="w-full truncate text-[10px] text-gray-500 dark:text-gray-400">
          {{ loading ? '' : tile.hint }}
        </p>
      </div>
    </div>

    <!-- What kind of month it is: the one distribution that changes what
         anyone does about it. -->
    <div v-if="hasMix" class="mt-3">
      <div class="flex h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
        <div
          v-for="segment in typeMix"
          :key="segment.key"
          :class="segment.barClass"
          :style="{ width: segmentWidth(segment.count) }"
        ></div>
      </div>
      <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          v-for="segment in typeMix"
          :key="segment.key"
          class="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 sm:text-xs"
        >
          <span :class="['h-2 w-2 shrink-0 rounded-full', segment.dotClass]"></span>
          {{ segment.label }}
          <span class="font-semibold tabular-nums text-gray-700 dark:text-gray-200">
            {{ segment.count }}
          </span>
        </span>
      </div>
    </div>

    <p
      v-else-if="!loading"
      class="mt-3 text-[10px] text-gray-400 dark:text-gray-500 sm:text-xs"
    >
      <template v-if="searching">Nothing in {{ stats.monthLabel }} matches your search.</template>
      <template v-else>Nothing on the calendar for {{ stats.monthLabel }}.</template>
    </p>
  </div>
</template>
