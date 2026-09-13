<script setup>
/**
 * The Sunday you came for, shown in full.
 *
 * Reading and editing are separate jobs and this does the first. The month is a
 * list of lines with one service opened out of it, and this panel is what
 * "opened out" means: everyone on it, role by role, then the songs with their
 * keys — laid out to be read rather than filled in.
 *
 * A role is one row: its name on the left, the people on the right. On a phone
 * that is still two short columns, and it reads down the page the way a
 * printed rota on the church noticeboard does.
 *
 * Editing happens in ScheduleEditorDrawer, which this hands off to. Anyone
 * Settings has granted Schedules gets the button, administrators included;
 * everyone else reads the same panel without it — and without the empty roles,
 * which are the planners' to-do list and only noise to the rest.
 *
 * Being on the schedule grants nothing extra. It adds a line at the top saying
 * so, because the person serving is the one who most needs to find their own
 * name.
 */
import { computed } from 'vue'
import { ListMusic, Pencil } from '../../icons'
import MemberAvatar from '../members/MemberAvatar.vue'
import { formatServiceDate, rosterName, serviceRoles } from '../../utils/lineupUtils'
import { SONG_LEADER_ROLE } from '../../data/scheduleRoles'

const props = defineProps({
  sunday: { type: Object, required: true },
  members: { type: Array, default: () => [] },
  roles: { type: Array, default: () => [] },
  canEdit: { type: Boolean, default: false },
  // The roles this account holds on this Sunday.
  myRoles: { type: Array, default: () => [] },
  isNext: { type: Boolean, default: false },
  isPast: { type: Boolean, default: false },
})

defineEmits(['edit'])

const rows = computed(() => serviceRoles(props.sunday, props.roles, props.members))

const visibleRows = computed(() =>
  props.canEdit ? rows.value : rows.value.filter((row) => row.people.length)
)

/** Roles still empty on a service to come — what the planner has left to do. */
const openRoles = computed(() =>
  props.isPast ? [] : rows.value.filter((row) => !row.people.length).map((row) => row.role.name)
)

const songs = computed(() => props.sunday.songs || [])

const isMine = computed(() => props.myRoles.length > 0)
const isLeading = computed(() => props.myRoles.some((role) => role.id === SONG_LEADER_ROLE))
const myRoleNames = computed(() => props.myRoles.map((role) => role.name).join(' and '))

/**
 * Where the songs stand, for whoever is leading them. Not a permission — she
 * can change no more than anyone else with schedules granted. She simply should
 * not have to count the list to find out whether Sunday is ready.
 */
const songReadiness = computed(() => {
  if (!isLeading.value || props.isPast) return ''
  return songs.value.length ? '' : 'No songs picked yet'
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
            v-if="isMine && !isPast"
            class="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
          >
            You&rsquo;re on
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

    <!-- Your own part in it, in one line -->
    <div
      v-if="isMine && !isPast"
      class="border-b border-primary/20 bg-primary/5 px-4 py-2.5 text-xs"
    >
      <p class="font-semibold text-gray-700 dark:text-gray-200">
        You&rsquo;re serving as {{ myRoleNames }}
      </p>
      <p v-if="songReadiness" class="mt-0.5 font-medium text-amber-600 dark:text-amber-400">
        {{ songReadiness }}
      </p>
    </div>

    <!-- Who serves -->
    <dl class="divide-y divide-gray-100 px-4 dark:divide-gray-700/60">
      <div
        v-for="row in visibleRows"
        :key="row.role.id"
        class="flex items-start gap-3 py-2.5"
      >
        <dt
          class="w-24 shrink-0 pt-0.5 text-[11px] font-bold uppercase leading-tight tracking-wide text-gray-400 sm:w-32"
        >
          {{ row.role.name }}
        </dt>
        <dd class="flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-1.5">
          <span
            v-for="person in row.people"
            :key="person.id"
            class="inline-flex min-w-0 items-center gap-1.5"
          >
            <MemberAvatar v-if="person.member" :member="person.member" alt="" size="h-6 w-6" />
            <span class="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {{ rosterName(person) }}
            </span>
          </span>
          <span v-if="!row.people.length" class="text-sm text-gray-300 dark:text-gray-600">
            Nobody yet
          </span>
        </dd>
      </div>
      <p
        v-if="!visibleRows.length"
        class="py-3 text-sm text-gray-400 dark:text-gray-500"
      >
        Nobody has been scheduled yet.
      </p>
    </dl>

    <p
      v-if="canEdit && openRoles.length && openRoles.length < rows.length"
      class="border-t border-gray-100 px-4 py-2 text-[11px] font-semibold text-amber-600 dark:border-gray-700 dark:text-amber-400"
    >
      Still open: {{ openRoles.join(', ') }}
    </p>

    <!-- The songs -->
    <div class="border-t border-gray-100 p-4 dark:border-gray-700">
      <p
        class="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-gray-400"
      >
        <ListMusic class="h-3 w-3" /> Songs
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

      <p v-else class="text-xs text-gray-400 dark:text-gray-500">No songs chosen yet.</p>
    </div>
  </div>
</template>
