<script setup>
import { computed } from 'vue'
import { Check, Trash2, User, Clock, Tag, ArrowUpCircle } from '../../icons'
import { assigneeLabel, dueLabel, isOverdue, isDueToday, isFlagged } from '../../utils/taskUtils'

// Whether this row may be ticked or deleted is decided once by the page and
// handed down, rather than resolved per row: a hundred rows each calling a
// permissions composable is a hundred lookups for one answer.
const props = defineProps({
  task: {
    type: Object,
    required: true,
  },
  selected: {
    type: Boolean,
    default: false,
  },
  /** May tick the box — the assignee, or anyone who manages tasks. */
  canComplete: {
    type: Boolean,
    default: false,
  },
  /** May open the editor and delete. */
  canEdit: {
    type: Boolean,
    default: false,
  },
  today: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['click', 'toggle', 'delete'])

const overdue = computed(() => isOverdue(props.task, props.today || undefined))
const dueToday = computed(() => isDueToday(props.task, props.today || undefined))

const due = computed(() => dueLabel(props.task.dueDate, props.today || undefined))

const dueClass = computed(() => {
  if (props.task.done) return 'text-gray-400 dark:text-gray-500'
  if (overdue.value) return 'text-red-600 dark:text-red-400 font-semibold'
  if (dueToday.value) return 'text-amber-600 dark:text-amber-400 font-semibold'
  return 'text-gray-500 dark:text-gray-400'
})

const priorityClass = computed(() =>
  props.task.priority === 'urgent'
    ? 'bg-red-500 text-white'
    : 'bg-orange-500 text-white'
)

const who = computed(() => assigneeLabel(props.task))
const unassigned = computed(() => !(props.task.assigneeIds || []).length)

const handleToggle = (event) => {
  event.stopPropagation()
  if (!props.canComplete) return
  emit('toggle', props.task)
}

const handleDelete = (event) => {
  event.stopPropagation()
  emit('delete', props.task)
}
</script>

<template>
  <div
    @click="canEdit && emit('click', task)"
    :class="[
      'flex items-start gap-1 px-2 py-1.5 sm:px-3 transition-colors border-l-4',
      canEdit ? 'cursor-pointer' : '',
      selected
        ? 'bg-primary/10 dark:bg-primary/20 border-primary'
        : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50'
    ]"
  >
    <!-- The box. Sized for a thumb rather than a cursor: ticking things off is
         what this page is for, and it happens on a phone, one-handed, on the
         way out of a meeting. -->
    <button
      @click="handleToggle"
      :disabled="!canComplete"
      :class="[
        'shrink-0 flex h-11 w-11 items-center justify-center rounded-full transition-colors',
        canComplete ? 'active:bg-gray-100 dark:active:bg-gray-700' : 'cursor-default'
      ]"
      :aria-pressed="task.done"
      :title="canComplete ? (task.done ? 'Mark as not done' : 'Mark as done') : 'Only the people it is assigned to can tick this off'"
      :aria-label="task.done ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`"
    >
      <span
        :class="[
          'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors',
          task.done
            ? 'border-green-600 bg-green-600 text-white dark:border-green-500 dark:bg-green-500'
            : 'border-gray-300 dark:border-gray-500'
        ]"
      >
        <Check v-if="task.done" class="h-4 w-4" />
      </span>
    </button>

    <div class="min-w-0 flex-1 py-1.5">
      <div class="flex items-start gap-2">
        <p
          :class="[
            'min-w-0 flex-1 text-sm font-medium break-words',
            task.done
              ? 'text-gray-400 dark:text-gray-500 line-through'
              : 'text-gray-900 dark:text-white'
          ]"
        >
          {{ task.title || 'Untitled task' }}
        </p>
        <span
          v-if="isFlagged(task) && !task.done"
          :class="['shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] capitalize', priorityClass]"
        >
          <ArrowUpCircle class="h-3 w-3" />
          {{ task.priority }}
        </span>
      </div>

      <!-- Read on the row rather than behind a tap. Whoever a task was handed
           to may only hold tasks.view, which is not enough to open the editor
           — and the note explaining what "sort the sound desk" means is no use
           to them if the editor is the only place it is written down. -->
      <p
        v-if="task.details && !task.done"
        class="mt-0.5 line-clamp-2 text-xs text-gray-600 dark:text-gray-400"
      >
        {{ task.details }}
      </p>

      <!-- Everything else about the task on one wrapping line: who owes it,
           when, and which ministry it belongs to. -->
      <div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span
          :class="[
            'flex items-center gap-1',
            unassigned
              ? 'text-gray-400 dark:text-gray-500 italic'
              : 'text-gray-600 dark:text-gray-400'
          ]"
        >
          <User class="h-3.5 w-3.5 shrink-0" />
          {{ who }}
        </span>
        <span v-if="due" :class="['flex items-center gap-1', dueClass]">
          <Clock class="h-3.5 w-3.5 shrink-0" />
          {{ due }}
        </span>
        <span v-if="task.ministry" class="flex items-center gap-1 text-gray-500 dark:text-gray-400">
          <Tag class="h-3.5 w-3.5 shrink-0" />
          {{ task.ministry }}
        </span>
        <span v-if="task.done && task.doneByName" class="text-gray-400 dark:text-gray-500">
          Done by {{ task.doneByName }}
        </span>
      </div>
    </div>

    <button
      v-if="canEdit"
      @click="handleDelete"
      class="mt-1 shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
      title="Delete task"
      :aria-label="`Delete ${task.title}`"
    >
      <Trash2 class="h-4 w-4" />
    </button>
  </div>
</template>
