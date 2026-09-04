<script setup>
/**
 * The Sunday you came for, open and editable where it sits.
 *
 * This replaces a full-screen drawer. Planning a service meant covering up the
 * month you were planning against, and the Save button at the bottom of it was
 * one more thing to forget on a Sunday morning. Edits here go straight up to
 * the page, which persists them by itself.
 *
 * One permission governs all of it: whoever Settings has granted Worship
 * lineups plans people and songs alike, and administrators bypass the check.
 * Leading this Sunday grants nothing extra — it changes what the panel shows,
 * not what it lets you do. `isMine` is a lens, `canEdit` is the gate.
 */
import { computed, ref, watch } from 'vue'
import {
  ChevronDown,
  ChevronUp,
  ListMusic,
  Mic2,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from '../../icons'
import { getAvatarUrl, getFullName } from '../../utils/memberUtils'
import { memberKey } from '../../utils/sgUtils'
import MemberAvatar from '../members/MemberAvatar.vue'
import {
  formatServiceDate,
  keyForLeader,
  songLeadersFrom,
  worshipTeamFrom,
} from '../../utils/lineupUtils'
import SongPickerSheet from './SongPickerSheet.vue'

const props = defineProps({
  sunday: { type: Object, required: true },
  members: { type: Array, default: () => [] },
  songs: { type: Array, default: () => [] },
  canEdit: { type: Boolean, default: false },
  isMine: { type: Boolean, default: false },
  isNext: { type: Boolean, default: false },
  isPast: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
})

const emit = defineEmits(['change', 'clear'])

// Declared before the watch below, which is immediate and resets every one of
// them: with these underneath it, that first synchronous run hit their temporal
// dead zone, setup threw, and the panel rendered no controls at all.
const showSongPicker = ref(false)
const showTeamPicker = ref(false)
const showAllLeaders = ref(false)
const showAllForTeam = ref(false)
const teamSearch = ref('')

/**
 * A local copy, re-seeded whenever a different service is focused.
 *
 * Not re-seeded when the same service changes underneath: that change is
 * usually this panel's own edit coming back through Firestore, and replacing
 * the form with it would move the cursor out of whatever is being typed.
 */
const form = ref(null)
watch(
  () => props.sunday?.date,
  () => {
    form.value = {
      ...props.sunday,
      teamIds: [...(props.sunday.teamIds || [])],
      songs: (props.sunday.songs || []).map((song) => ({ ...song })),
    }
    showSongPicker.value = false
    showTeamPicker.value = false
    showAllLeaders.value = false
    showAllForTeam.value = false
    teamSearch.value = ''
  },
  { immediate: true }
)

/** Every edit goes up immediately; the page decides when to write it. */
const change = () => emit('change', { ...form.value })

const memberById = (id) =>
  props.members.find((m) => memberKey(m) === String(id) || String(m.firestoreId) === String(id)) ||
  null

const leader = computed(() => memberById(form.value?.leaderId))
const leaderName = computed(() => (leader.value ? getFullName(leader.value) : ''))

const leaders = computed(() => songLeadersFrom(props.members))
const noLeadersAssigned = computed(() => leaders.value.length === 0)
const leaderOptions = computed(() => {
  if (showAllLeaders.value || noLeadersAssigned.value) {
    return [...props.members].sort((a, b) => getFullName(a).localeCompare(getFullName(b)))
  }
  return leaders.value
})

const songById = (songId) => props.songs.find((s) => String(s.id) === String(songId)) || null

/**
 * Changing the leader re-seeds the keys, because a key belongs to the person
 * singing it. Only keys that still match the previous leader (or were never
 * set) are touched, so a deliberate transposition typed in for this service
 * survives the swap.
 */
const onLeaderChange = (nextId) => {
  const previousId = form.value.leaderId
  form.value.leaderId = nextId || null
  form.value.songs = form.value.songs.map((entry) => {
    const song = songById(entry.songId)
    if (!song) return entry
    const previousKey = keyForLeader(song, previousId)
    const isUntouched = !entry.key || entry.key === previousKey
    return isUntouched ? { ...entry, key: keyForLeader(song, nextId) } : entry
  })
  change()
}

const addSongs = (entries) => {
  form.value.songs = [...form.value.songs, ...entries]
  change()
}

const removeSong = (index) => {
  form.value.songs = form.value.songs.filter((_, i) => i !== index)
  change()
}

const moveSong = (index, delta) => {
  const next = [...form.value.songs]
  const target = index + delta
  if (target < 0 || target >= next.length) return
  ;[next[index], next[target]] = [next[target], next[index]]
  form.value.songs = next
  change()
}

const teamMembers = computed(() =>
  (form.value?.teamIds || []).map((id) => ({ id, member: memberById(id) }))
)

/** Song leaders and instrumentalists: the people a band is actually made of. */
const worshipTeam = computed(() => worshipTeamFrom(props.members))

/** Nobody rostered in a worship ministry, so filtering would offer nothing at
 *  all. The whole roster is a worse list but a usable one. */
const noWorshipAssigned = computed(() => worshipTeam.value.length === 0)

const teamCandidates = computed(() => {
  const query = teamSearch.value.trim().toLowerCase()
  const chosen = new Set((form.value?.teamIds || []).map(String))
  const pool =
    showAllForTeam.value || noWorshipAssigned.value ? props.members : worshipTeam.value
  return pool
    .filter((m) => !chosen.has(memberKey(m)) && memberKey(m) !== String(form.value?.leaderId))
    .filter((m) => !query || getFullName(m).toLowerCase().includes(query))
    .sort((a, b) => getFullName(a).localeCompare(getFullName(b)))
    .slice(0, 8)
})

const addToTeam = (member) => {
  form.value.teamIds = [...form.value.teamIds, memberKey(member)]
  teamSearch.value = ''
  change()
}

const removeFromTeam = (id) => {
  form.value.teamIds = form.value.teamIds.filter((entry) => String(entry) !== String(id))
  change()
}

const chosenSongIds = computed(() => (form.value?.songs || []).map((s) => s.songId))

/**
 * The week's leader gets told where her service stands, in one line.
 *
 * Not a permission — she can change no more than anyone else with lineups
 * granted. It is simply that the person standing up front on Sunday is the one
 * who most needs to know whether the songs are picked and who is playing, and
 * she should not have to count the list to find out.
 */
const bandNames = computed(() =>
  teamMembers.value.map((row) => (row.member ? getFullName(row.member) : 'Former member'))
)

const readiness = computed(() => {
  const missing = []
  if (!form.value?.songs?.length) missing.push('no songs picked yet')
  if (!form.value?.teamIds?.length) missing.push('no band yet')
  return missing
})
</script>

<template>
  <div
    v-if="form"
    :class="[
      'rounded-2xl border bg-white dark:bg-gray-800',
      isNext || isMine
        ? 'border-primary ring-1 ring-primary/25'
        : 'border-gray-200 dark:border-gray-700',
    ]"
  >
    <!-- Which service this is, and how it stands -->
    <div class="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <p class="truncate text-sm font-bold text-gray-900 dark:text-white">
            {{ formatServiceDate(form.date) }}
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
        <!-- Saving is worth a word and not a dialog: edits go up on their own,
             and the only thing anyone needs to know is that they landed. -->
        <p class="mt-0.5 text-[11px] font-medium text-gray-400">
          <template v-if="saving">Saving…</template>
          <template v-else-if="canEdit">Changes save themselves</template>
          <template v-else>
            {{ form.songs.length }} {{ form.songs.length === 1 ? 'song' : 'songs' }}
          </template>
        </p>
      </div>

      <button
        v-if="canEdit"
        type="button"
        @click="$emit('clear', form.date)"
        class="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
      >
        Clear
      </button>
    </div>

    <!-- Your own Sunday, summarised. Everyone can edit the same things; this
         is the one who has to stand up and lead it, so she gets told at a
         glance what is settled and what is not. -->
    <div
      v-if="isMine && !isPast"
      class="border-b border-primary/20 bg-primary/5 px-4 py-2.5 text-xs"
    >
      <p class="font-semibold text-gray-700 dark:text-gray-200">
        {{ form.songs.length }} {{ form.songs.length === 1 ? 'song' : 'songs' }}
        <template v-if="bandNames.length">
          · playing with {{ bandNames.join(', ') }}
        </template>
      </p>
      <p v-if="readiness.length" class="mt-0.5 font-medium text-amber-600 dark:text-amber-400">
        Still to sort: {{ readiness.join(' · ') }}
      </p>
      <p v-else class="mt-0.5 font-medium text-emerald-600 dark:text-emerald-400">
        Ready to go
      </p>
    </div>

    <div class="space-y-4 p-4">
      <!-- Leader -->
      <div>
        <div class="mb-1 flex items-center justify-between gap-2">
          <label for="panel-leader" class="text-[11px] font-bold uppercase tracking-wide text-gray-400">
            Song leader
          </label>
          <button
            v-if="canEdit && !noLeadersAssigned"
            type="button"
            @click="showAllLeaders = !showAllLeaders"
            class="text-[11px] font-semibold text-primary dark:text-primary-light"
          >
            {{ showAllLeaders ? 'Song leaders only' : 'Show all members' }}
          </button>
        </div>

        <select
          v-if="canEdit"
          id="panel-leader"
          :value="form.leaderId ?? ''"
          @change="onLeaderChange($event.target.value)"
          class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">Unassigned</option>
          <option v-for="member in leaderOptions" :key="memberKey(member)" :value="memberKey(member)">
            {{ getFullName(member) }}
          </option>
        </select>

        <div
          v-else
          class="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-gray-900/50"
        >
          <MemberAvatar v-if="leader" :member="leader" alt="" size="h-6 w-6" />
          <Mic2 v-else class="h-4 w-4 text-gray-400" />
          <span class="min-w-0 truncate text-sm font-medium text-gray-900 dark:text-white">
            {{ leaderName || 'Unassigned' }}
          </span>
        </div>

        <p v-if="canEdit && noLeadersAssigned" class="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
          No one serves in the Song Leader ministry yet, so every member is listed.
        </p>
      </div>

      <!-- Theme -->
      <div v-if="canEdit">
        <label for="panel-theme" class="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">
          Theme or occasion
        </label>
        <input
          id="panel-theme"
          v-model="form.theme"
          @input="change"
          type="text"
          placeholder="e.g. Thanksgiving Sunday"
          class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
      </div>
      <p v-else-if="form.theme" class="text-sm font-semibold text-primary dark:text-primary-light">
        {{ form.theme }}
      </p>

      <!-- Songs -->
      <div>
        <div class="mb-2 flex items-center justify-between gap-2">
          <label class="text-[11px] font-bold uppercase tracking-wide text-gray-400">
            Service order
          </label>
          <button
            v-if="canEdit"
            type="button"
            @click="showSongPicker = true"
            class="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary dark:text-primary-light"
          >
            <Plus class="h-3.5 w-3.5" />
            Add songs
          </button>
        </div>

        <p
          v-if="!form.songs.length"
          class="rounded-xl border border-dashed border-gray-300 p-5 text-center text-xs text-gray-500 dark:border-gray-600 dark:text-gray-400"
        >
          <ListMusic class="mx-auto mb-1.5 h-7 w-7 text-gray-300 dark:text-gray-600" />
          {{ canEdit ? 'No songs yet. Pull them from the song list.' : 'No songs chosen yet.' }}
        </p>

        <!-- Read-only for anyone who is not planning this service: the tech
             team and the rest of the band still need to read the order. -->
        <ol v-else-if="!canEdit" class="space-y-1">
          <li
            v-for="(entry, index) in form.songs"
            :key="`${entry.songId}-${index}`"
            class="flex items-baseline gap-2 text-sm"
          >
            <span class="w-4 shrink-0 text-[11px] font-bold tabular-nums text-gray-300 dark:text-gray-600">
              {{ index + 1 }}
            </span>
            <span class="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-200">
              {{ entry.title }}
              <span v-if="entry.note" class="text-xs text-gray-400">· {{ entry.note }}</span>
            </span>
            <span
              v-if="entry.key"
              class="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-200"
            >
              {{ entry.key }}
            </span>
          </li>
        </ol>

        <ul v-else class="space-y-2">
          <li
            v-for="(entry, index) in form.songs"
            :key="`${entry.songId}-${index}`"
            class="rounded-xl border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-900/40"
          >
            <div class="flex items-start gap-2">
              <span
                class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary dark:text-primary-light"
              >
                {{ index + 1 }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {{ entry.title }}
                </p>
                <p v-if="entry.category" class="text-[11px] text-gray-500 dark:text-gray-400">
                  {{ entry.category }}
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  @click="moveSong(index, -1)"
                  :disabled="index === 0"
                  class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                  aria-label="Move up"
                >
                  <ChevronUp class="h-4 w-4" />
                </button>
                <button
                  type="button"
                  @click="moveSong(index, 1)"
                  :disabled="index === form.songs.length - 1"
                  class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                  aria-label="Move down"
                >
                  <ChevronDown class="h-4 w-4" />
                </button>
                <button
                  type="button"
                  @click="removeSong(index)"
                  class="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                  aria-label="Remove song"
                >
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>
            </div>

            <div class="mt-2 flex items-center gap-2">
              <input
                v-model="entry.key"
                @input="change"
                type="text"
                placeholder="Key"
                :aria-label="`Key for ${entry.title}`"
                class="w-16 shrink-0 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-center text-sm font-bold text-gray-900 focus:border-transparent focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              <input
                v-model="entry.note"
                @input="change"
                type="text"
                placeholder="Note (e.g. opener, key change on last chorus)"
                :aria-label="`Note for ${entry.title}`"
                class="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </li>
        </ul>
      </div>

      <!-- The band -->
      <div>
        <div class="mb-2 flex items-center justify-between gap-2">
          <label class="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">
            <Users class="h-3 w-3" /> Band
          </label>
          <button
            v-if="canEdit"
            type="button"
            @click="showTeamPicker = !showTeamPicker"
            class="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary dark:text-primary-light"
          >
            <Plus class="h-3.5 w-3.5" />
            Add
          </button>

        </div>

        <div v-if="teamMembers.length" class="flex flex-wrap gap-1.5">
          <span
            v-for="row in teamMembers"
            :key="row.id"
            class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 py-1 pl-1 pr-2 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200"
          >
            <img
              v-if="row.member"
              :src="getAvatarUrl(row.member)"
              alt=""
              class="h-5 w-5 rounded-full object-cover"
            />
            {{ row.member ? getFullName(row.member) : 'Former member' }}
            <button
              v-if="canEdit"
              type="button"
              @click="removeFromTeam(row.id)"
              class="text-gray-400 hover:text-red-600"
              :aria-label="`Remove ${row.member ? getFullName(row.member) : 'member'}`"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
        <p v-else class="text-xs text-gray-400 dark:text-gray-500">Nobody on the band yet.</p>

        <div
          v-if="showTeamPicker && canEdit"
          class="mt-2 space-y-1 rounded-xl border border-gray-200 p-2 dark:border-gray-700"
        >
          <div class="flex items-center justify-between gap-2 px-1">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              {{ showAllForTeam || noWorshipAssigned ? 'All members' : 'Worship ministries' }}
            </p>
            <button
              v-if="!noWorshipAssigned"
              type="button"
              @click="showAllForTeam = !showAllForTeam"
              class="text-[11px] font-semibold text-primary dark:text-primary-light"
            >
              {{ showAllForTeam ? 'Worship only' : 'Show all members' }}
            </button>
          </div>

          <p v-if="noWorshipAssigned" class="px-1 text-[11px] text-amber-600 dark:text-amber-400">
            Nobody serves in a worship ministry yet, so every member is listed.
          </p>

          <div class="relative">
            <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              v-model="teamSearch"
              type="search"
              placeholder="Search members"
              class="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <button
            v-for="member in teamCandidates"
            :key="memberKey(member)"
            type="button"
            @click="addToTeam(member)"
            class="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            <MemberAvatar :member="member" alt="" size="h-7 w-7" />
            <span class="truncate text-sm text-gray-800 dark:text-gray-100">
              {{ getFullName(member) }}
            </span>
          </button>

          <p v-if="!teamCandidates.length" class="p-2 text-[11px] text-gray-500 dark:text-gray-400">
            {{
              showAllForTeam || noWorshipAssigned
                ? 'No members match.'
                : 'Nobody in the worship ministries matches. Show all members to look wider.'
            }}
          </p>
        </div>
      </div>

      <!-- Notes for the team -->
      <div v-if="canEdit">
        <label for="panel-notes" class="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">
          Notes for the team
        </label>
        <textarea
          id="panel-notes"
          v-model="form.notes"
          @input="change"
          rows="2"
          placeholder="Practice schedule, reminders, anything the team should know"
          class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
      </div>
      <p v-else-if="form.notes" class="whitespace-pre-line text-xs text-gray-500 dark:text-gray-400">
        {{ form.notes }}
      </p>
    </div>

    <SongPickerSheet
      v-model:show="showSongPicker"
      :songs="songs"
      :chosen-ids="chosenSongIds"
      :leader-id="form.leaderId"
      :leader-name="leaderName"
      @add="addSongs"
    />
  </div>
</template>
