<script setup>
/**
 * What the page shows while Claude is writing up the notes.
 *
 * There are two honest states and they look different on purpose:
 *
 *   Reading   — the model is working the notes out and there is genuinely
 *               nothing to show yet. A skeleton and a clock, so the wait is
 *               visibly a wait rather than a page that failed to load.
 *   Writing   — the document is arriving. It is rendered as it comes, which
 *               is the real indicator: you can watch the Discussion section
 *               fill in and know exactly how far along it is.
 *
 * No progress bar. The endpoint cannot say how long it has left, and a bar
 * that invents a percentage is worse than a clock that admits it does not
 * know — minutes are already a thing people wait on and then re-press.
 */

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Sparkles } from '../../icons'
import { markdownToHtml } from '../../utils/markdownUtils'
import { sectionIcon } from '../../utils/minuteSections'

const props = defineProps({
  active: { type: Boolean, default: false },
  phase: { type: String, default: 'reading' }, // 'reading' | 'writing'
  text: { type: String, default: '' },
  // "the whole meeting" or the agenda item's name, so the line says what is
  // being worked on when a meeting has a dozen items.
  subject: { type: String, default: '' },
})

const elapsed = ref(0)
let timer = null

watch(
  () => props.active,
  (active) => {
    clearInterval(timer)
    if (!active) return
    elapsed.value = 0
    timer = setInterval(() => { elapsed.value += 1 }, 1000)
  },
  { immediate: true }
)

onBeforeUnmount(() => clearInterval(timer))

const clock = computed(() => {
  const seconds = elapsed.value
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`
})

const heading = computed(() =>
  props.phase === 'writing' ? 'Writing the minutes' : 'Reading the notes'
)

const detail = computed(() => {
  if (props.phase === 'writing') return 'The page below is filling in as it is written.'
  // Said plainly rather than cycled through cheerful stages: the wait is real
  // and the reason for it is worth knowing.
  if (elapsed.value > 45) return 'Long notes take longer. Still going.'
  return props.subject ? `Working through ${props.subject}.` : 'Working through the notes.'
})

// Only the finished part of the draft is rendered. A half-written table row
// would otherwise flicker through several wrong shapes on its way to being
// right, which reads as the model changing its mind.
const settled = computed(() => {
  const text = props.text || ''
  const cut = text.lastIndexOf('\n')
  return cut > 0 ? text.slice(0, cut) : ''
})

// No mention or date highlighting on the draft. Those are for reading a
// finished record, and running the roster over a document that grows by a few
// characters at a time is work for nothing.
const draftHtml = computed(() =>
  settled.value ? markdownToHtml(settled.value, { headingIcon: sectionIcon }) : ''
)
</script>

<template>
  <div v-if="active" class="space-y-3">
    <div
      class="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 dark:border-primary-light/30 dark:bg-primary-light/10"
      role="status"
      aria-live="polite"
    >
      <span class="relative flex h-8 w-8 shrink-0 items-center justify-center">
        <span class="absolute inset-0 animate-ping rounded-full bg-primary/30" />
        <Sparkles class="relative h-5 w-5 text-primary dark:text-primary-light" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ heading }}<span class="writing-dots" aria-hidden="true"></span>
        </p>
        <p class="truncate text-xs text-gray-500 dark:text-gray-400">{{ detail }}</p>
      </div>
      <span
        class="shrink-0 font-mono text-xs tabular-nums text-gray-400 dark:text-gray-500"
        :aria-label="`${elapsed} seconds elapsed`"
      >
        {{ clock }}
      </span>
    </div>

    <!-- Reading: nothing to show yet, so show that there will be. -->
    <div
      v-if="phase !== 'writing' || !draftHtml"
      class="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
      aria-hidden="true"
    >
      <div class="skeleton h-5 w-2/5 rounded" />
      <div class="skeleton h-3 w-full rounded" />
      <div class="skeleton h-3 w-11/12 rounded" />
      <div class="skeleton h-3 w-4/5 rounded" />
      <div class="skeleton mt-5 h-5 w-1/3 rounded" />
      <div class="skeleton h-3 w-full rounded" />
      <div class="skeleton h-3 w-3/4 rounded" />
    </div>

    <!-- Writing: the document itself, as far as it has got. -->
    <div
      v-else
      class="minute-body rounded-lg border border-primary/30 bg-white p-4 text-gray-900 dark:border-primary-light/30 dark:bg-gray-800 dark:text-white"
    >
      <div v-html="draftHtml"></div>
      <span class="caret" aria-hidden="true"></span>
    </div>
  </div>
</template>

<style scoped>
.skeleton {
  background: linear-gradient(
    90deg,
    rgb(0 0 0 / 0.06) 25%,
    rgb(0 0 0 / 0.12) 37%,
    rgb(0 0 0 / 0.06) 63%
  );
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
}

:global(.dark) .skeleton {
  background: linear-gradient(
    90deg,
    rgb(255 255 255 / 0.06) 25%,
    rgb(255 255 255 / 0.12) 37%,
    rgb(255 255 255 / 0.06) 63%
  );
  background-size: 400% 100%;
}

@keyframes shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

/* The three dots after "Writing the minutes", in CSS so no timer is needed. */
.writing-dots::after {
  content: '';
  animation: dots 1.5s steps(4, end) infinite;
}

@keyframes dots {
  0% { content: ''; }
  25% { content: '.'; }
  50% { content: '..'; }
  75% { content: '...'; }
}

.caret {
  display: inline-block;
  width: 2px;
  height: 1.1em;
  vertical-align: text-bottom;
  background: currentColor;
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  50% { opacity: 0; }
}

/* Anyone who has asked for less motion gets the states without the movement;
   the clock still ticks, which is the part that carries the information. */
@media (prefers-reduced-motion: reduce) {
  .skeleton,
  .writing-dots::after,
  .caret {
    animation: none;
  }
  .writing-dots::after {
    content: '...';
  }
}
</style>
