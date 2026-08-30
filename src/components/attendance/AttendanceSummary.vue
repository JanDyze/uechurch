<script setup>
import { computed } from 'vue'
import { UserCheck, CalendarDays, TrendingUp, TrendingDown } from '../../icons'

const props = defineProps({
  stats: {
    type: Object,
    required: true,
  },
  recentBars: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const dash = '—'

const percent = (value) => (value === null || value === undefined ? dash : `${value}%`)

// Percentage points, signed, because the direction is the whole message.
const trendValue = computed(() => {
  const trend = props.stats.trend
  if (trend === null || trend === undefined) return dash
  if (trend === 0) return 'Level'
  return `${trend > 0 ? '+' : '−'}${Math.abs(trend)}`
})

const tiles = computed(() => [
  {
    key: 'latest',
    icon: UserCheck,
    label: 'Last time',
    value: percent(props.stats.latestShare),
    hint:
      props.stats.latestCount === null
        ? 'nothing recorded yet'
        : `${props.stats.latestCount} of ${props.stats.roster}`,
  },
  {
    key: 'reach',
    icon: CalendarDays,
    // Not an average turnout: the share of people who came to at least one
    // thing that month. Mixed gathering types cannot move it.
    label: 'Reached',
    value: percent(props.stats.reachShare),
    hint: props.stats.monthLongLabel ? `in ${props.stats.monthLongLabel}` : 'no gatherings yet',
  },
  {
    key: 'trend',
    // Up and down are the same size of news, so the icon flips rather than
    // the number turning into a warning.
    icon: (props.stats.trend ?? 0) < 0 ? TrendingDown : TrendingUp,
    label: 'Trend',
    value: trendValue.value,
    hint: props.stats.trendLabel,
    valueClass:
      props.stats.trend === null || props.stats.trend === undefined || props.stats.trend === 0
        ? ''
        : props.stats.trend > 0
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-amber-600 dark:text-amber-400',
  },
])

// A gathering nobody came to is still a fact worth seeing, so an empty bar
// keeps a sliver of width rather than vanishing off the axis.
const barWidth = (share) => `${Math.max(share, 3)}%`

// Newest at the top: the row people look for first should not be the one they
// have to scan to the end to find.
const bars = computed(() => [...props.recentBars].reverse())

const hasBars = computed(() => !props.loading && props.recentBars.length > 0)
</script>

<template>
  <div class="shrink-0 border-b border-gray-200 px-3 py-3 dark:border-gray-700">
    <!-- One row of three, readable without scrolling even on a phone. -->
    <div class="grid grid-cols-3 divide-x divide-gray-200 dark:divide-gray-700">
      <div
        v-for="tile in tiles"
        :key="tile.key"
        class="flex flex-col items-center px-1 text-center"
      >
        <div class="flex items-center gap-1 text-gray-400 dark:text-gray-500">
          <component :is="tile.icon" class="h-3 w-3 shrink-0" />
          <span class="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide">
            {{ tile.label }}
          </span>
        </div>
        <p
          :class="[
            'text-xl font-bold tabular-nums text-gray-900 dark:text-white sm:text-2xl',
            tile.valueClass,
          ]"
        >
          {{ loading ? dash : tile.value }}
        </p>
        <p class="truncate text-[10px] text-gray-500 dark:text-gray-400">
          {{ loading ? '' : tile.hint }}
        </p>
      </div>
    </div>

    <!-- Rows, not columns: a column chart hides its labels in a tooltip and
         there is no hover on a phone. Here the date sits in the layout, and
         one gathering reads as well as eight. -->
    <div v-if="hasBars" class="mt-3 space-y-1">
      <div
        v-for="(bar, index) in bars"
        :key="bar.key"
        class="flex items-center gap-2"
        :title="`${bar.title} · ${bar.dateLabel} · ${bar.count} present (${bar.share}%)`"
      >
        <span
          class="w-12 shrink-0 truncate text-[10px] tabular-nums text-gray-400 dark:text-gray-500"
        >
          {{ bar.dateLabel }}
        </span>
        <div
          class="h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-gray-100 dark:bg-gray-700/60"
        >
          <div
            :class="['h-full rounded-sm', index === 0 ? 'bg-primary' : 'bg-primary/40']"
            :style="{ width: barWidth(bar.share) }"
          ></div>
        </div>
        <span
          class="w-14 shrink-0 text-right text-[10px] tabular-nums text-gray-500 dark:text-gray-400"
        >
          {{ bar.count }} · {{ bar.share }}%
        </span>
      </div>
    </div>

    <div v-if="hasBars" class="mt-2 flex items-baseline justify-between gap-3">
      <p class="min-w-0 truncate text-[10px] text-gray-500 dark:text-gray-400 sm:text-xs">
        <span class="font-medium text-gray-700 dark:text-gray-200">{{ stats.latestTitle }}</span>
        <span v-if="stats.latestDateLabel"> · {{ stats.latestDateLabel }}</span>
      </p>
      <p class="shrink-0 text-[10px] text-gray-400 dark:text-gray-500 sm:text-xs">
        <span v-if="stats.monthGatherings">
          {{ stats.monthGatherings }} in {{ stats.monthShortLabel }} ·
        </span>
        of {{ stats.roster }} people
      </p>
    </div>

    <p
      v-else-if="!loading"
      class="mt-3 text-[10px] text-gray-400 dark:text-gray-500 sm:text-xs"
    >
      Record a gathering and its turnout starts showing up here.
    </p>
  </div>
</template>
