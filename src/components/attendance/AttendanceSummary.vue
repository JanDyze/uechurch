<script setup>
import { computed } from 'vue'
import { ChevronUp, ChevronRight, UserX, Users } from '../../icons'

// Three lines, none of which the list below can say.
//
// The list is the page: a row per gathering, each with its own count, colour
// and gauge. So the summary carries only what is invisible there — the union
// across gatherings (how many people we saw at all), the people who have
// stopped turning up, and the size of the recording backlog. Leading with the
// last gathering's turnout, as this once did, was the first row of the list
// printed twice.
//
// The panel is also the button that collapses it, as on People. The two real
// actions in here stop the click themselves.

const props = defineProps({
  stats: {
    type: Object,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  canRecord: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['hide', 'record'])

const reach = computed(() => props.stats.reach)
const quiet = computed(() => props.stats.quiet)
const awaiting = computed(() => props.stats.awaiting)

// "Ana and Ben +7" reads; a list of nine names in a 10px line does not.
const quietNames = computed(() => {
  const people = quiet.value
  if (!people) return ''
  const names = people.names.join(', ')
  return people.others ? `${names} +${people.others}` : names
})

const handlePrompt = (event) => {
  if (!props.canRecord) return
  event.stopPropagation()
  emit('record', props.stats.awaiting.key)
}
</script>

<template>
  <div
    @click="emit('hide')"
    class="group relative shrink-0 cursor-pointer border-b border-gray-200 px-3 py-2.5 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"
  >
    <button
      @click.stop="emit('hide')"
      aria-label="Hide summary"
      class="absolute right-1 top-1 rounded-md p-1 text-gray-300 transition-colors group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400"
    >
      <ChevronUp class="h-3.5 w-3.5" />
    </button>

    <div v-if="loading" class="space-y-2">
      <div class="h-4 w-52 animate-pulse rounded bg-gray-200 dark:bg-gray-600"></div>
      <div class="h-2 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-600"></div>
      <div class="h-3 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-600"></div>
    </div>

    <template v-else>
      <!-- 1. The one figure that really is out of the whole church: different
           people seen at all this month. No single row knows it. -->
      <div v-if="reach" class="pr-5">
        <div class="flex items-baseline justify-between gap-2">
          <p class="min-w-0 truncate text-xs text-gray-600 dark:text-gray-300">
            <Users class="mr-1 inline h-3.5 w-3.5 -translate-y-px text-gray-400" />
            <span class="font-bold tabular-nums text-gray-900 dark:text-white">
              {{ reach.count }}
            </span>
            of {{ stats.roster }} people came in {{ reach.monthLabel }}
          </p>
          <p
            class="shrink-0 text-xs font-semibold tabular-nums text-primary dark:text-primary-light"
          >
            {{ reach.share === null ? '—' : `${reach.share}%` }}
          </p>
        </div>

        <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
          <div
            class="h-full rounded-full bg-linear-to-r from-primary to-emerald-400 transition-[width] duration-700 ease-out"
            :style="{ width: `${Math.max(reach.share || 0, 2)}%` }"
          ></div>
        </div>

        <p
          v-if="reach.priorCount !== null"
          class="mt-1 truncate text-[10px] text-gray-400 dark:text-gray-500"
        >
          {{ reach.priorCount }} in {{ reach.priorLabel }}
        </p>
      </div>

      <!-- 2. The only pastoral fact on the page. A list arranged by gathering
           can never show who has quietly stopped coming. -->
      <p
        v-if="quiet"
        :class="['flex items-start gap-1.5 text-[11px] leading-snug', reach ? 'mt-2' : '']"
      >
        <UserX class="mt-px h-3.5 w-3.5 shrink-0 text-gray-400" />
        <span class="min-w-0 text-gray-600 dark:text-gray-300">
          <span class="font-semibold text-gray-900 dark:text-white">{{ quiet.count }}</span>
          not seen in {{ quiet.weeks }} weeks
          <span class="text-gray-400 dark:text-gray-500">— {{ quietNames }}</span>
        </span>
      </p>

      <!-- 3. The backlog, and the way in to clearing it. -->
      <component
        :is="canRecord ? 'button' : 'div'"
        v-if="awaiting"
        @click="handlePrompt"
        :class="[
          'mt-2 flex w-full items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-left transition-colors dark:bg-amber-500/10',
          canRecord ? 'hover:bg-amber-100 dark:hover:bg-amber-500/20' : '',
        ]"
      >
        <span class="min-w-0 flex-1 truncate text-[11px] text-amber-800 dark:text-amber-300">
          <span class="font-semibold">{{ awaiting.count }}</span>
          {{ awaiting.count === 1 ? 'gathering' : 'gatherings' }} still to record
          <span class="text-amber-700/70 dark:text-amber-300/60">
            · {{ awaiting.title }}, {{ awaiting.whenLabel }}
          </span>
        </span>
        <ChevronRight v-if="canRecord" class="h-3.5 w-3.5 shrink-0 text-amber-500" />
      </component>

      <p v-if="!reach && !awaiting" class="pr-5 text-xs text-gray-400 dark:text-gray-500">
        Nothing recorded yet. A gathering turns up here to record once it has passed.
      </p>
    </template>
  </div>
</template>
