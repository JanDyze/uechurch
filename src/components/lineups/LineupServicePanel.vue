<script setup>
/**
 * The Sunday you came for, shown in full.
 *
 * Reading and editing are separate jobs and this does the first. The month is a
 * list of lines with one service opened out of it, and this panel is what
 * "opened out" means: leader, band, the order with its keys, notes — everything
 * about a service, laid out to be read rather than filled in.
 *
 * Editing happens in SundayEditorDrawer, which this hands off to. Anyone
 * Settings has granted Worship lineups gets the button, administrators
 * included; everyone else reads the same panel without it.
 *
 * Leading this Sunday grants nothing extra. It adds a summary at the top,
 * because the person standing up front is the one who most needs to know
 * whether the songs are picked and who is playing.
 */
import { computed } from 'vue'
import { ListMusic, Mic2, Pencil, StickyNote, Users } from '../../icons'
import { getAvatarUrl, getFullName } from '../../utils/memberUtils'
import { memberKey } from '../../utils/sgUtils'
import MemberAvatar from '../members/MemberAvatar.vue'
import { formatServiceDate } from '../../utils/lineupUtils'

const props = defineProps({
  sunday: { type: Object, required: true },
  members: { type: Array, default: () => [] },
  canEdit: { type: Boolean, default: false },
  isMine: { type: Boolean, default: false },
  isNext: { type: Boolean, default: false },
  isPast: { type: Boolean, default: false },
})

defineEmits(['edit'])

const memberById = (id) =>
  props.members.find((m) => memberKey(m) === String(id) || String(m.firestoreId) === String(id)) ||
  null

const leader = computed(() => memberById(props.sunday.leaderId))
const leaderName = computed(() => (leader.value ? getFullName(leader.value) : ''))

const team = computed(() =>
  (props.sunday.teamIds || []).map((id) => ({ id, member: memberById(id) }))
)

const songs = computed(() => props.sunday.songs || [])

/**
 * Where the service stands, for the person who has to lead it.
 *
 * Not a permission — she can change no more than anyone else with lineups
 * granted. She simply should not have to count the list to find out whether
 * Sunday is ready.
 */
const bandNames = computed(() =>
  team.value.map((row) => (row.member ? getFullName(row.member) : 'Former member'))
)

const readiness = computed(() => {
  const missing = []
  if (!songs.value.length) missing.push('no songs picked yet')
  if (!team.value.length) missing.push('no band yet')
  return missing
})
</script>

<template>
  <div
    :class="[
      'rounded-2xl border bg-white dark:bg-gray-800',
      isNext || isMine
        ? 'border-primary ring-1 ring-primary/25'
        : 'border-gray-200 dark:border-gray-700',
    ]"
  >
    <!-- Which service this is, and the one way in to changing it -->
    <div
      class="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-700"
    >
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <p class="truncate text-sm font-bold text-gray-900 dark:text-white">
            {{ formatServiceDate(sunday.date) }}
          </p>
          <span
            v-if="isMine"
            class="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
          >
            You&rsquo;re leading
          </span>
          <span
            v-else-if="isNext && !isPast"
            class="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary dark:text-primary-light"
          >
            Up next
          </span>
          <span
            v-else-if="isPast"
            class="shrink-0 text-[10px] font-bold uppercase tracking-wide text-gray-400"
          >
            Already run
          </span>
        </div>
        <p
          v-if="sunday.theme"
          class="mt-0.5 truncate text-xs font-semibold text-primary dark:text-primary-light"
        >
          {{ sunday.theme }}
        </p>
      </div>

      <button
        v-if="canEdit"
        type="button"
        @click="$emit('edit', sunday)"
        class="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-hover"
      >
        <Pencil class="h-3.5 w-3.5" />
        Edit
      </button>
    </div>

    <!-- Your own Sunday, summarised -->
    <div
      v-if="isMine && !isPast"
      class="border-b border-primary/20 bg-primary/5 px-4 py-2.5 text-xs"
    >
      <p class="font-semibold text-gray-700 dark:text-gray-200">
        {{ songs.length }} {{ songs.length === 1 ? 'song' : 'songs' }}
        <template v-if="bandNames.length">· playing with {{ bandNames.join(', ') }}</template>
      </p>
      <p v-if="readiness.length" class="mt-0.5 font-medium text-amber-600 dark:text-amber-400">
        Still to sort: {{ readiness.join(' · ') }}
      </p>
      <p v-else class="mt-0.5 font-medium text-emerald-600 dark:text-emerald-400">Ready to go</p>
    </div>

    <div class="space-y-4 p-4">
      <!-- Leader -->
      <div>
        <p
          class="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-gray-400"
        >
          <Mic2 class="h-3 w-3" /> Song leader
        </p>
        <div class="flex items-center gap-2">
          <MemberAvatar v-if="leader" :member="leader" alt="" size="h-8 w-8" />
          <span
            v-else
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700"
          >
            <Mic2 class="h-4 w-4 text-gray-400" />
          </span>
          <span
            :class="[
              'min-w-0 truncate text-sm font-semibold',
              leader ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500',
            ]"
          >
            {{ leaderName || 'Nobody assigned yet' }}
          </span>
        </div>
      </div>

      <!-- The band -->
      <div>
        <p
          class="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-gray-400"
        >
          <Users class="h-3 w-3" /> Band
          <span v-if="team.length" class="text-gray-300 dark:text-gray-600">{{ team.length }}</span>
        </p>
        <div v-if="team.length" class="flex flex-wrap gap-1.5">
          <span
            v-for="row in team"
            :key="row.id"
            class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 py-1 pl-1 pr-2.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200"
          >
            <img
              v-if="row.member"
              :src="getAvatarUrl(row.member)"
              alt=""
              class="h-5 w-5 rounded-full object-cover"
            />
            {{ row.member ? getFullName(row.member) : 'Former member' }}
          </span>
        </div>
        <p v-else class="text-xs text-gray-400 dark:text-gray-500">Nobody on the band yet.</p>
      </div>

      <!-- The order -->
      <div>
        <p
          class="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-gray-400"
        >
          <ListMusic class="h-3 w-3" /> Service order
          <span v-if="songs.length" class="text-gray-300 dark:text-gray-600">{{ songs.length }}</span>
        </p>

        <ol v-if="songs.length" class="space-y-1.5">
          <li
            v-for="(entry, index) in songs"
            :key="`${entry.songId}-${index}`"
            class="flex items-baseline gap-2.5"
          >
            <span
              class="w-5 shrink-0 text-right text-[11px] font-bold tabular-nums text-gray-300 dark:text-gray-600"
            >
              {{ index + 1 }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm text-gray-800 dark:text-gray-100">
                {{ entry.title }}
              </span>
              <span v-if="entry.note" class="block truncate text-[11px] text-gray-400">
                {{ entry.note }}
              </span>
            </span>
            <span
              v-if="entry.key"
              class="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-200"
            >
              {{ entry.key }}
            </span>
          </li>
        </ol>

        <p
          v-else
          class="rounded-xl border border-dashed border-gray-300 p-5 text-center text-xs text-gray-500 dark:border-gray-600 dark:text-gray-400"
        >
          <ListMusic class="mx-auto mb-1.5 h-7 w-7 text-gray-300 dark:text-gray-600" />
          No songs chosen yet.
        </p>
      </div>

      <!-- Notes -->
      <div v-if="sunday.notes">
        <p
          class="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-gray-400"
        >
          <StickyNote class="h-3 w-3" /> Notes for the team
        </p>
        <p class="whitespace-pre-line text-xs text-gray-600 dark:text-gray-300">
          {{ sunday.notes }}
        </p>
      </div>
    </div>
  </div>
</template>
