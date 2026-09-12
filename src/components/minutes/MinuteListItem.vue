<script setup>
/**
 * One meeting, in a list of meetings.
 *
 * It used to carry the title, the date, the start and end times, the location
 * and "4 attendees", behind a document icon identical on every row. Four of
 * those five are the same on every row — the church meets in the same hall, at
 * the same time, with roughly the same people — so the row read as a form
 * while answering neither question anyone opens the list with: which meeting,
 * and has it been written up?
 *
 * Now: the date as something you can find by shape, the title, and where the
 * minute has got to. The clock times and the venue are on the minute itself.
 */

import { computed } from 'vue'
import { ChevronRight, ListChecks, MoreVertical } from '../../icons'
import { meetingWhen, minuteProgress, minuteActionCount } from '../../utils/minuteSummary'

const props = defineProps({
  minute: { type: Object, required: true },
  canEdit: { type: Boolean, default: false },
  // A meeting that is coming but has not been written into. There is no record
  // behind it yet — see useScheduledMinutes.
  starting: { type: Boolean, default: false },
})

const emit = defineEmits(['open', 'menu'])

const scheduled = computed(() => props.minute.isScheduled === true)
const when = computed(() => meetingWhen(props.minute.date))
const progress = computed(() => minuteProgress(props.minute))
const actions = computed(() => (scheduled.value ? 0 : minuteActionCount(props.minute)))

// Notes taken and never written up is the state that needs somebody, so it is
// the only one that gets a colour.
const TONE = {
  done: 'text-gray-500 dark:text-gray-400',
  attention: 'text-amber-600 dark:text-amber-400',
  idle: 'text-gray-400 dark:text-gray-500',
}
</script>

<template>
  <button
    type="button"
    @click="emit('open', minute)"
    class="group flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-gray-50 sm:gap-4 sm:px-4 dark:hover:bg-gray-700/50"
  >
    <!-- The date, as a shape rather than a sentence. A list of meetings is
         scanned by when, so the when is the thing with a size. -->
    <div
      :class="[
        'flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border',
        // Dashed while there is nothing behind it: the row is a standing
        // arrangement, not a document.
        scheduled && 'border-dashed',
        when.upcoming || scheduled
          ? 'border-primary/40 bg-primary/5 text-primary dark:border-primary-light/40 dark:bg-primary-light/10 dark:text-primary-light'
          : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300',
      ]"
    >
      <span class="text-base font-bold leading-none tabular-nums">{{ when.day || '—' }}</span>
      <span class="mt-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">
        {{ when.month }}
      </span>
    </div>

    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-semibold text-gray-900 dark:text-white">
        {{ minute.title || 'Untitled meeting' }}
      </p>
      <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        <span v-if="when.relative" class="text-gray-400 dark:text-gray-500">
          {{ when.relative }}
        </span>
        <span v-if="when.relative" class="text-gray-300 dark:text-gray-600">·</span>
        <span v-if="scheduled" class="font-medium text-primary dark:text-primary-light">
          {{ starting ? 'Starting…' : 'Not started' }}
        </span>
        <span v-else :class="TONE[progress.tone]">{{ progress.label }}</span>
      </div>
    </div>

    <!-- What the meeting left behind. A count of commitments is the only
         number on this page anyone acts on. -->
    <span
      v-if="actions"
      class="hidden shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 sm:flex dark:bg-blue-400/10 dark:text-blue-300"
      :title="`${actions} action ${actions === 1 ? 'item' : 'items'}`"
    >
      <ListChecks class="h-3.5 w-3.5" />
      {{ actions }}
    </span>

    <!-- Nothing to edit or delete on a row that is not a record yet. -->
    <span
      v-if="canEdit && !scheduled"
      role="button"
      tabindex="0"
      @click.stop="emit('menu', { minute, event: $event })"
      @keydown.enter.stop.prevent="emit('menu', { minute, event: $event })"
      class="shrink-0 rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-gray-200 hover:text-gray-600 dark:text-gray-600 dark:hover:bg-gray-600 dark:hover:text-gray-200"
      :aria-label="`Actions for ${minute.title || 'this meeting'}`"
    >
      <MoreVertical class="h-4 w-4" />
    </span>
    <ChevronRight
      v-else
      class="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 dark:text-gray-600"
    />
  </button>
</template>
