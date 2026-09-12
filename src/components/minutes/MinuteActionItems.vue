<script setup>
/**
 * The Action Items table, again — but as buttons.
 *
 * The table above this panel is the record and stays exactly as it was
 * written. This is the same rows read back out, each with the one thing a
 * minute cannot do on its own: put the commitment somewhere it will be seen
 * again. Nothing is added automatically; a minute is a proposal to the person
 * reading it, not a queue that fills someone else's list behind their back.
 *
 * A row already on the list shows as such rather than offering the button
 * twice, matched on wording — the same test whether it was added a minute ago
 * or last month.
 */

import { computed } from 'vue'
import { Check, ListChecks, Loader2, Plus, UserRound, CalendarDays } from '../../icons'
import { dueLabel } from '../../utils/taskUtils'

const props = defineProps({
  items: { type: Array, default: () => [] },   // drafts from toTaskDraft
  tasks: { type: Array, default: () => [] },   // the live To-do list
  saving: { type: Array, default: () => [] },  // titles currently being written
  canEdit: { type: Boolean, default: true },
})

const emit = defineEmits(['add', 'add-all', 'open-tasks'])

const key = (title) =>
  String(title || '').trim().toLowerCase().replace(/[^a-z0-9 ]/g, '')

const existing = computed(() => new Set(props.tasks.map((task) => key(task.title))))

const rows = computed(() =>
  props.items.map((item) => ({
    ...item,
    added: existing.value.has(key(item.title)),
    busy: props.saving.includes(item.title),
  }))
)

const pending = computed(() => rows.value.filter((row) => !row.added && !row.busy))
</script>

<template>
  <div
    v-if="rows.length"
    class="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4 dark:border-gray-700 dark:bg-gray-900/40"
  >
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 class="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
        <ListChecks class="h-4 w-4 text-primary" />
        {{ rows.length }} action {{ rows.length === 1 ? 'item' : 'items' }} in these minutes
      </h3>
      <button
        v-if="canEdit && pending.length > 1"
        @click="emit('add-all', pending)"
        class="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
      >
        Add all {{ pending.length }} to To-do
      </button>
      <button
        v-else-if="!pending.length"
        @click="emit('open-tasks')"
        class="text-xs font-medium text-primary underline dark:text-primary-light"
      >
        All on the To-do list
      </button>
    </div>

    <ul class="space-y-2">
      <li
        v-for="row in rows"
        :key="row.title"
        class="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-gray-900 dark:text-white">{{ row.title }}</p>
          <div
            v-if="row.assigneeNames.length || row.dueDate || row.timelineText"
            class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400"
          >
            <span v-if="row.assigneeNames.length" class="flex items-center gap-1">
              <UserRound class="h-3.5 w-3.5" />
              {{ row.assigneeNames.join(', ') }}
            </span>
            <span v-if="row.dueDate" class="flex items-center gap-1">
              <CalendarDays class="h-3.5 w-3.5" />
              {{ dueLabel(row.dueDate) }}
            </span>
            <!-- What the minute actually said, next to what was made of it.
                 "By Friday" resolving to a date is a guess, and the guess has
                 to be checkable without scrolling back up to the table. -->
            <span v-if="row.timelineText && row.timelineText !== row.dueDate" class="italic">
              &ldquo;{{ row.timelineText }}&rdquo;
            </span>
          </div>
        </div>

        <span
          v-if="row.added"
          class="flex shrink-0 items-center gap-1 rounded-lg bg-green-100 px-2.5 py-1.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400"
        >
          <Check class="h-3.5 w-3.5" />
          On the list
        </span>
        <button
          v-else-if="canEdit"
          @click="emit('add', row)"
          :disabled="row.busy"
          class="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
          :title="`Add to the To-do list${row.assigneeNames.length ? ` for ${row.assigneeNames.join(', ')}` : ''}`"
        >
          <Loader2 v-if="row.busy" class="h-3.5 w-3.5 animate-spin" />
          <Plus v-else class="h-3.5 w-3.5" />
          Add
        </button>
      </li>
    </ul>
  </div>
</template>
