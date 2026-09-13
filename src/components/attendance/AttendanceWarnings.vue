<script setup>
import { computed } from 'vue'
import { ChevronRight, UserX } from '../../icons'

// What is left of the summary: only the lines that ask somebody to do
// something. "38 of 114 people came in August" was a figure to look at, and a
// month's head count said that way read as a verdict on the church rather than
// a record of it. The backlog and the people who have stopped coming are
// different — each is a job — so they stay, and they are shown only when there
// is one. With nothing owed the list starts at the top of the page.

const props = defineProps({
  stats: {
    type: Object,
    required: true,
  },
  canRecord: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['record'])

const quiet = computed(() => props.stats.quiet)
const awaiting = computed(() => props.stats.awaiting)

// "Ana and Ben +7" reads; a list of nine names in an 11px line does not.
const quietNames = computed(() => {
  const people = quiet.value
  if (!people) return ''
  const names = people.names.join(', ')
  return people.others ? `${names} +${people.others}` : names
})

const handlePrompt = () => {
  if (!props.canRecord) return
  emit('record', awaiting.value.key)
}
</script>

<template>
  <div
    v-if="awaiting || quiet"
    class="shrink-0 space-y-1.5 border-b border-gray-200 px-3 py-2 dark:border-gray-700"
  >
    <!-- The backlog, and the way in to clearing it. -->
    <component
      :is="canRecord ? 'button' : 'div'"
      v-if="awaiting"
      @click="handlePrompt"
      :class="[
        'flex w-full items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-left transition-colors dark:bg-amber-500/10',
        canRecord ? 'hover:bg-amber-100 dark:hover:bg-amber-500/20' : '',
      ]"
    >
      <span class="min-w-0 flex-1 truncate text-xs text-amber-800 dark:text-amber-300">
        <span class="font-semibold">{{ awaiting.count }}</span>
        {{ awaiting.count === 1 ? 'gathering' : 'gatherings' }} still to record
        <span class="text-amber-700/70 dark:text-amber-300/60">
          · {{ awaiting.title }}, {{ awaiting.whenLabel }}
        </span>
      </span>
      <ChevronRight v-if="canRecord" class="h-3.5 w-3.5 shrink-0 text-amber-500" />
    </component>

    <!-- The only pastoral fact on the page. A list arranged by gathering can
         never show who has quietly stopped coming. -->
    <p v-if="quiet" class="flex items-start gap-1.5 px-2 text-xs leading-snug">
      <UserX class="mt-px h-3.5 w-3.5 shrink-0 text-gray-400" />
      <span class="min-w-0 text-gray-600 dark:text-gray-300">
        <span class="font-semibold text-gray-900 dark:text-white">{{ quiet.count }}</span>
        not seen in {{ quiet.weeks }} weeks
        <span class="text-gray-400 dark:text-gray-500">— {{ quietNames }}</span>
      </span>
    </p>
  </div>
</template>
