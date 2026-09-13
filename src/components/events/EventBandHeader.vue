<script setup>
// The heading over a run of events — a day in the agenda, Done and Upcoming in
// the month list. The same sticky strip the People list puts over an age band,
// so a list of gatherings and a list of people read as one app.

defineProps({
  label: {
    type: String,
    required: true,
  },
  count: {
    type: Number,
    default: null,
  },
  // Something true of the whole run rather than of one row: a holiday.
  note: {
    type: String,
    default: '',
  },
  // Whether the heading itself does something — opens the day, folds the
  // section. Rendered as a button only then, so a screen reader is not told
  // about a control that is not there.
  clickable: {
    type: Boolean,
    default: false,
  },
  highlight: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['click'])
</script>

<template>
  <component
    :is="clickable ? 'button' : 'div'"
    :type="clickable ? 'button' : undefined"
    @click="clickable && $emit('click')"
    :class="[
      'sticky top-0 z-10 flex w-full items-center gap-2 border-b border-gray-100 bg-white/95 px-3 py-2 text-left backdrop-blur dark:border-gray-700 dark:bg-gray-800/95',
      clickable ? 'transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/80' : '',
    ]"
  >
    <span
      :class="[
        'shrink-0 text-xs font-bold uppercase tracking-wide',
        highlight ? 'text-primary' : 'text-gray-500 dark:text-gray-400',
      ]"
    >
      {{ label }}
    </span>
    <span v-if="count !== null" class="shrink-0 text-xs tabular-nums text-gray-400 dark:text-gray-500">
      {{ count }}
    </span>
    <!-- A holiday is a fact about the date, not an event you can open, so it
         is quiet text on the heading rather than a row of its own. -->
    <span
      v-if="note"
      class="flex min-w-0 items-center gap-1.5 text-xs text-yellow-700 dark:text-yellow-500"
    >
      <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500"></span>
      <span class="truncate">{{ note }}</span>
    </span>
    <span class="ml-auto flex shrink-0 items-center">
      <slot />
    </span>
  </component>
</template>
