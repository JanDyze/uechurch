<script setup>
/**
 * Notes to whoever writes the minutes up next — which is Claude.
 *
 * The write-up is a first draft by something that was not at the meeting, so
 * it gets things wrong in ways only the secretary can see: a booking that was
 * confirmed after the notes were typed, a name heard as a task owner who was
 * only mentioned, an item that needs more room than the notes gave it. Before
 * this, the only fix was to edit the finished page by hand — and pressing
 * "Write again" then threw the correction away and made the same mistake.
 *
 * A comment survives the rewrite. It is sent with the notes, so the correction
 * is applied every time, and it stays on the record afterwards as the reason
 * the minute reads the way it does.
 *
 * Comments are not part of the minutes. They never appear in the written page,
 * the export or the printed copy.
 */

import { computed, ref } from 'vue'
import { Check, ChatCircleText, Plus, Trash2, X } from '../../icons'

const props = defineProps({
  comments: { type: Array, default: () => [] },
  canEdit: { type: Boolean, default: true },
  // Text the reader had selected when they opened the box, so an instruction
  // can point at the line it is about.
  quote: { type: String, default: '' },
  scope: { type: String, default: 'this item' },
})

const emit = defineEmits(['add', 'remove', 'clear-quote'])

const draft = ref('')
const open = ref(false)
const saving = ref(false)

const pending = computed(() => props.comments.filter((comment) => !comment.appliedAt))
const applied = computed(() => props.comments.filter((comment) => comment.appliedAt))
const showApplied = ref(false)

const submit = () => {
  const text = draft.value.trim()
  if (!text || saving.value) return
  saving.value = true
  emit('add', { text, quote: props.quote }, (ok) => {
    saving.value = false
    if (ok) {
      draft.value = ''
      open.value = false
      emit('clear-quote')
    }
  })
}

const start = () => {
  open.value = true
}
</script>

<template>
  <div class="mt-6">
    <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
      <h3 class="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
        <ChatCircleText class="h-4 w-4 text-primary" />
        Notes for the rewrite
        <span
          v-if="pending.length"
          class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary dark:bg-primary-light/15 dark:text-primary-light"
        >
          {{ pending.length }}
        </span>
      </h3>
      <button
        v-if="canEdit && !open"
        @click="start"
        class="flex items-center gap-1 text-xs font-medium text-primary hover:underline dark:text-primary-light"
      >
        <Plus class="h-3.5 w-3.5" />
        Add a note
      </button>
    </div>

    <!-- The box -->
    <div
      v-if="open"
      class="mb-3 rounded-xl border border-primary/40 bg-white p-3 dark:border-primary-light/40 dark:bg-gray-800"
    >
      <div
        v-if="quote"
        class="mb-2 flex items-start gap-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs text-gray-500 dark:bg-gray-900/50 dark:text-gray-400"
      >
        <span class="min-w-0 flex-1 truncate italic">&ldquo;{{ quote }}&rdquo;</span>
        <button @click="emit('clear-quote')" class="shrink-0 hover:text-gray-700 dark:hover:text-gray-200">
          <X class="h-3.5 w-3.5" />
        </button>
      </div>

      <textarea
        v-model="draft"
        rows="3"
        :placeholder="`What should change about ${scope}? e.g. &quot;the sound system is confirmed now, not pending&quot;`"
        class="w-full resize-y rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none dark:border-gray-600 dark:text-white"
      />
      <div class="mt-2 flex items-center justify-between gap-2">
        <p class="text-xs text-gray-400 dark:text-gray-500">
          Applied every time these notes are written up.
        </p>
        <div class="flex shrink-0 items-center gap-2">
          <button
            @click="open = false; draft = ''"
            class="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            @click="submit"
            :disabled="!draft.trim() || saving"
            class="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>

    <!-- What is waiting to be applied -->
    <ul v-if="pending.length" class="space-y-2">
      <li
        v-for="comment in pending"
        :key="comment.id"
        class="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="min-w-0 flex-1">
          <p v-if="comment.quote" class="mb-1 truncate text-xs italic text-gray-400 dark:text-gray-500">
            on &ldquo;{{ comment.quote }}&rdquo;
          </p>
          <p class="text-sm text-gray-800 dark:text-gray-100">{{ comment.text }}</p>
          <p v-if="comment.authorName" class="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {{ comment.authorName }}
          </p>
        </div>
        <button
          v-if="canEdit"
          @click="emit('remove', comment.id)"
          class="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          :aria-label="`Remove note: ${comment.text}`"
        >
          <Trash2 class="h-4 w-4" />
        </button>
      </li>
    </ul>

    <p
      v-else-if="!open"
      class="rounded-lg border border-dashed border-gray-200 px-3 py-2.5 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500"
    >
      Nothing to change. Select a line and add a note to correct the next rewrite.
    </p>

    <!-- Already folded into the page -->
    <div v-if="applied.length" class="mt-2">
      <button
        @click="showApplied = !showApplied"
        class="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <Check class="h-3.5 w-3.5" />
        {{ applied.length }} already applied
      </button>
      <ul v-if="showApplied" class="mt-2 space-y-1.5">
        <li
          v-for="comment in applied"
          :key="comment.id"
          class="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-900/40 dark:text-gray-400"
        >
          <Check class="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
          <span class="min-w-0 flex-1">{{ comment.text }}</span>
          <button
            v-if="canEdit"
            @click="emit('remove', comment.id)"
            class="shrink-0 hover:text-red-500"
            :aria-label="`Remove note: ${comment.text}`"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
