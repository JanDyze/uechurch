<script setup>
/**
 * One Sunday, collapsed to a line.
 *
 * The month used to be four fully expanded cards, which meant scrolling past
 * three services to reach the one you came for. Only the focused service is
 * expanded now; the rest are these — enough to tell whether a Sunday is
 * staffed and sung, and nothing more.
 *
 * What a row must answer at a glance: is there a leader, are there songs, and
 * is anything missing. Everything else waits until it is tapped.
 */
import { computed } from 'vue'
import { ChevronRight, Mic2, Warning } from '../../icons'
import { getFullName } from '../../utils/memberUtils'
import { memberKey } from '../../utils/sgUtils'
import MemberAvatar from '../members/MemberAvatar.vue'
import { formatShortDate } from '../../utils/lineupUtils'

const props = defineProps({
  sunday: { type: Object, required: true },
  members: { type: Array, default: () => [] },
  isMine: { type: Boolean, default: false },
  isPast: { type: Boolean, default: false },
  // The head is the one who can act on a missing leader, so only they are
  // warned about it — to everyone else it is just not filled in yet.
  showGaps: { type: Boolean, default: false },
})

defineEmits(['focus'])

const leader = computed(
  () =>
    props.members.find(
      (m) =>
        memberKey(m) === String(props.sunday.leaderId) ||
        String(m.firestoreId) === String(props.sunday.leaderId)
    ) || null
)

const songCount = computed(() => props.sunday.songs?.length || 0)
const bandCount = computed(() => props.sunday.teamIds?.length || 0)

/** A gap worth flagging, and only on a service still to come. */
const needsLeader = computed(() => props.showGaps && !props.isPast && !props.sunday.leaderId)
</script>

<template>
  <button
    type="button"
    @click="$emit('focus', sunday.date)"
    :class="[
      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
      isPast
        ? 'text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-700/40'
        : 'hover:bg-gray-100 dark:hover:bg-gray-700/60',
      isMine ? 'bg-primary/5' : '',
    ]"
  >
    <span
      :class="[
        'w-14 shrink-0 rounded-lg px-1.5 py-1 text-center text-[11px] font-bold',
        isMine
          ? 'bg-primary text-white'
          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
      ]"
    >
      {{ formatShortDate(sunday.date) }}
    </span>

    <span class="flex min-w-0 flex-1 items-center gap-2">
      <MemberAvatar v-if="leader" :member="leader" alt="" size="h-6 w-6" />
      <span
        v-else
        class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700"
      >
        <Mic2 class="h-3 w-3 text-gray-400" />
      </span>

      <span class="min-w-0">
        <span
          :class="[
            'block truncate text-sm font-semibold',
            leader ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500',
          ]"
        >
          {{ leader ? getFullName(leader) : 'No leader' }}
        </span>
        <span class="block truncate text-[11px] font-medium text-gray-400">
          {{ songCount }} {{ songCount === 1 ? 'song' : 'songs' }}
          <template v-if="bandCount">
            · {{ bandCount }} on the band
          </template>
          <template v-if="sunday.theme">· {{ sunday.theme }}</template>
        </span>
      </span>
    </span>

    <Warning
      v-if="needsLeader"
      class="h-4 w-4 shrink-0 text-amber-500"
      aria-label="Nobody leading yet"
    />
    <ChevronRight class="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
  </button>
</template>
