<script setup>
import { computed, ref, watch } from 'vue'
import {
  ChevronDown,
  ChevronUp,
  ListMusic,
  Plus,
  Search,
  Trash2,
  X,
} from '../../icons'
import { useMediaQuery } from '../../composables/useMediaQuery'
import { useFocusTrap } from '../../composables/useFocusTrap'
import { getAvatarUrl, getFullName } from '../../utils/memberUtils'
import MemberAvatar from '../members/MemberAvatar.vue'
import { memberKey } from '../../utils/sgUtils'
import { formatServiceDate, keyForLeader, songLeadersFrom } from '../../utils/lineupUtils'
import SongPickerSheet from './SongPickerSheet.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  sunday: { type: Object, default: null },
  members: { type: Array, default: () => [] },
  songs: { type: Array, default: () => [] },
  saving: { type: Boolean, default: false },
  // Which of the two jobs this person is here to do. The worship ministry head
  // staffs the service; the leader named on it chooses its songs. The drawer
  // shows both halves either way — a leader should be able to see who she is
  // playing with — and only lets each edit their own.
  canEditRoster: { type: Boolean, default: false },
})

const emit = defineEmits(['update:show', 'save', 'clear'])

const isMobile = useMediaQuery('(max-width: 1023px)')
const dialogRef = ref(null)
const form = ref(null)
const showSongPicker = ref(false)
const showAllMembers = ref(false)
const teamSearch = ref('')
const showTeamPicker = ref(false)

// Re-seed on open so editing one Sunday and then another never carries values
// across.
watch(
  () => [props.show, props.sunday?.date],
  ([show]) => {
    if (!show || !props.sunday) return
    form.value = {
      ...props.sunday,
      teamIds: [...(props.sunday.teamIds || [])],
      songs: (props.sunday.songs || []).map((s) => ({ ...s })),
    }
    showSongPicker.value = false
    showTeamPicker.value = false
    teamSearch.value = ''
    showAllMembers.value = false
  },
  { immediate: true }
)

const close = () => emit('update:show', false)
useFocusTrap(dialogRef, computed(() => props.show), close)

const leaders = computed(() => songLeadersFrom(props.members))

// Nobody assigned to the Song Leader ministry yet, so the picker falls back to
// the whole roster rather than being empty and unusable.
const noLeadersAssigned = computed(() => leaders.value.length === 0)

const leaderOptions = computed(() => {
  if (showAllMembers.value || noLeadersAssigned.value) {
    return [...props.members].sort((a, b) => getFullName(a).localeCompare(getFullName(b)))
  }
  return leaders.value
})

const memberById = (id) =>
  props.members.find((m) => memberKey(m) === String(id) || String(m.firestoreId) === String(id)) ||
  null

const leaderName = computed(() => {
  const member = memberById(form.value?.leaderId)
  return member ? getFullName(member) : ''
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
}

const addSongs = (entries) => {
  form.value.songs = [...form.value.songs, ...entries]
}

const removeSong = (index) => {
  form.value.songs = form.value.songs.filter((_, i) => i !== index)
}

const moveSong = (index, delta) => {
  const next = [...form.value.songs]
  const target = index + delta
  if (target < 0 || target >= next.length) return
  ;[next[index], next[target]] = [next[target], next[index]]
  form.value.songs = next
}

const teamMembers = computed(() =>
  (form.value?.teamIds || []).map((id) => ({ id, member: memberById(id) }))
)

const teamCandidates = computed(() => {
  const q = teamSearch.value.trim().toLowerCase()
  const chosen = new Set((form.value?.teamIds || []).map(String))
  return props.members
    .filter((m) => !chosen.has(memberKey(m)) && memberKey(m) !== String(form.value?.leaderId))
    .filter((m) => !q || getFullName(m).toLowerCase().includes(q))
    .sort((a, b) => getFullName(a).localeCompare(getFullName(b)))
    .slice(0, 8)
})

const addToTeam = (member) => {
  form.value.teamIds = [...form.value.teamIds, memberKey(member)]
  teamSearch.value = ''
}

const removeFromTeam = (id) => {
  form.value.teamIds = form.value.teamIds.filter((t) => String(t) !== String(id))
}

const handleSave = () => {
  if (props.saving || !form.value) return
  emit('save', {
    ...form.value,
    theme: form.value.theme.trim(),
    notes: form.value.notes.trim(),
    songs: form.value.songs.map((s) => ({ ...s, key: (s.key || '').trim(), note: (s.note || '').trim() })),
  })
}
</script>

<template>
  <Teleport to="body" :disabled="!isMobile">
    <Transition :name="isMobile ? 'modal-sheet' : 'drawer'">
      <div
        v-if="show && form"
        :class="[
          isMobile
            ? 'fixed inset-0 z-80 flex flex-col justify-end'
            : 'lineup-drawer m-3 rounded-2xl border-2 border-primary/30 dark:border-primary-light/30 bg-white dark:bg-gray-800 w-[calc(50%-1.5rem)] h-[calc(100%-1.5rem)] flex flex-col shrink-0 overflow-hidden shadow-xl shadow-primary/25 dark:shadow-primary-light/20',
        ]"
      >
        <div v-if="isMobile" class="absolute inset-0 bg-black/50" @click="close" />

        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lineup-sunday-title"
          tabindex="-1"
          :class="[
            'flex flex-col min-h-0',
            isMobile
              ? 'relative z-10 w-full max-h-[92dvh] rounded-t-2xl bg-white dark:bg-gray-800 shadow-2xl border-t border-gray-200 dark:border-gray-700'
              : 'flex-1',
          ]"
        >
          <!-- Header -->
          <div class="shrink-0 rounded-t-2xl border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <h3 id="lineup-sunday-title" class="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {{ formatServiceDate(form.date) }}
              </h3>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                <template v-if="canEditRoster">
                  Assign who serves, and plan the order
                </template>
                <template v-else>
                  Your service &mdash; choose the songs
                </template>
                &middot; {{ form.songs.length }} song{{ form.songs.length === 1 ? '' : 's' }}
              </p>
            </div>
            <button
              @click="close"
              class="shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-5">
            <!-- Leader. Read-only for the leader herself: being named here is
                 what gave her this drawer, so it is not hers to change. -->
            <div v-if="!canEditRoster">
              <p class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Song leader
              </p>
              <div
                class="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-gray-900/50"
              >
                <MemberAvatar
                  v-if="memberById(form.leaderId)"
                  :member="memberById(form.leaderId)"
                  alt=""
                  size="h-7 w-7"
                />
                <span class="min-w-0 truncate text-sm font-medium text-gray-900 dark:text-white">
                  {{ leaderName || 'Unassigned' }}
                </span>
              </div>
            </div>

            <!-- Leader -->
            <div v-else>
              <div class="flex items-center justify-between gap-2 mb-1">
                <label for="lineup-leader" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Song leader
                </label>
                <button
                  v-if="!noLeadersAssigned"
                  type="button"
                  @click="showAllMembers = !showAllMembers"
                  class="text-xs font-semibold text-primary dark:text-primary-light"
                >
                  {{ showAllMembers ? 'Song leaders only' : 'Show all members' }}
                </button>
              </div>
              <select
                id="lineup-leader"
                :value="form.leaderId ?? ''"
                @change="onLeaderChange($event.target.value)"
                class="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">Unassigned</option>
                <option v-for="member in leaderOptions" :key="memberKey(member)" :value="memberKey(member)">
                  {{ getFullName(member) }}
                </option>
              </select>
              <p v-if="noLeadersAssigned" class="mt-1 text-xs text-amber-600 dark:text-amber-400">
                No one serves in the Song Leader ministry yet, so every member is listed.
              </p>
            </div>

            <!-- Theme -->
            <div>
              <label for="lineup-theme" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Theme or occasion
              </label>
              <input
                id="lineup-theme"
                v-model="form.theme"
                type="text"
                placeholder="e.g. Thanksgiving Sunday"
                class="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <!-- Songs -->
            <div>
              <div class="flex items-center justify-between gap-2 mb-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Service order
                </label>
                <button
                  type="button"
                  @click="showSongPicker = true"
                  class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary dark:text-primary-light text-xs font-semibold"
                >
                  <Plus class="h-3.5 w-3.5" />
                  Add songs
                </button>
              </div>

              <p
                v-if="!form.songs.length"
                class="p-6 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-center text-sm text-gray-500 dark:text-gray-400"
              >
                <ListMusic class="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
                No songs yet. Pull them from the song list.
              </p>

              <ul v-else class="space-y-2">
                <li
                  v-for="(entry, index) in form.songs"
                  :key="`${entry.songId}-${index}`"
                  class="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40"
                >
                  <div class="flex items-start gap-2">
                    <span class="shrink-0 mt-0.5 h-6 w-6 rounded-full bg-primary/10 text-primary dark:text-primary-light text-xs font-bold flex items-center justify-center">
                      {{ index + 1 }}
                    </span>
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {{ entry.title }}
                      </p>
                      <p v-if="entry.category" class="text-xs text-gray-500 dark:text-gray-400">
                        {{ entry.category }}
                      </p>
                    </div>
                    <div class="shrink-0 flex items-center gap-0.5">
                      <button
                        type="button"
                        @click="moveSong(index, -1)"
                        :disabled="index === 0"
                        class="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30"
                        aria-label="Move up"
                      >
                        <ChevronUp class="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        @click="moveSong(index, 1)"
                        :disabled="index === form.songs.length - 1"
                        class="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30"
                        aria-label="Move down"
                      >
                        <ChevronDown class="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        @click="removeSong(index)"
                        class="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        aria-label="Remove song"
                      >
                        <Trash2 class="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div class="mt-2 flex items-center gap-2">
                    <input
                      v-model="entry.key"
                      type="text"
                      placeholder="Key"
                      :aria-label="`Key for ${entry.title}`"
                      class="w-20 shrink-0 px-2 py-1.5 text-sm font-bold text-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <input
                      v-model="entry.note"
                      type="text"
                      placeholder="Note (e.g. opener, key change on last chorus)"
                      :aria-label="`Note for ${entry.title}`"
                      class="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </li>
              </ul>
            </div>

            <!-- Team -->
            <div>
              <div class="flex items-center justify-between gap-2 mb-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Worship team
                </label>
                <button
                  v-if="canEditRoster"
                  type="button"
                  @click="showTeamPicker = !showTeamPicker"
                  class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary dark:text-primary-light text-xs font-semibold"
                >
                  <Plus class="h-3.5 w-3.5" />
                  Add
                </button>
                <span
                  v-else
                  class="text-[11px] font-semibold uppercase tracking-wide text-gray-400"
                >
                  Set by the worship head
                </span>
              </div>

              <p
                v-if="!canEditRoster && !teamMembers.length"
                class="mb-2 text-xs text-gray-400 dark:text-gray-500"
              >
                Nobody on the band yet.
              </p>

              <div v-if="teamMembers.length" class="flex flex-wrap gap-1.5 mb-2">
                <span
                  v-for="row in teamMembers"
                  :key="row.id"
                  class="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-700 dark:text-gray-200"
                >
                  <img
                    v-if="row.member"
                    :src="getAvatarUrl(row.member)"
                    alt=""
                    class="h-5 w-5 rounded-full object-cover"
                  />
                  {{ row.member ? getFullName(row.member) : 'Former member' }}
                  <button
                    v-if="canEditRoster"
                    type="button"
                    @click="removeFromTeam(row.id)"
                    class="text-gray-400 hover:text-red-600"
                    :aria-label="`Remove ${row.member ? getFullName(row.member) : 'member'}`"
                  >
                    <X class="h-3.5 w-3.5" />
                  </button>
                </span>
              </div>

              <div v-if="showTeamPicker && canEditRoster" class="rounded-xl border border-gray-200 dark:border-gray-700 p-2 space-y-1">
                <div class="relative">
                  <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    v-model="teamSearch"
                    type="search"
                    placeholder="Search members"
                    class="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <button
                  v-for="member in teamCandidates"
                  :key="memberKey(member)"
                  type="button"
                  @click="addToTeam(member)"
                  class="w-full flex items-center gap-2 p-2 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <MemberAvatar :member="member" alt="" size="h-7 w-7" />
                  <span class="text-sm text-gray-800 dark:text-gray-100 truncate">
                    {{ getFullName(member) }}
                  </span>
                </button>
                <p v-if="!teamCandidates.length" class="p-2 text-xs text-gray-500 dark:text-gray-400">
                  No members match.
                </p>
              </div>
            </div>

            <!-- Notes -->
            <div>
              <label for="lineup-notes" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes for the team
              </label>
              <textarea
                id="lineup-notes"
                v-model="form.notes"
                rows="3"
                placeholder="Practice schedule, reminders, anything the team should know"
                class="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          <!-- Footer -->
          <div class="shrink-0 border-t border-gray-200 dark:border-gray-700 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex items-center gap-2">
            <!-- Clearing wipes the leader and the band along with the songs,
                 so it stays with whoever assigned them. -->
            <button
              v-if="canEditRoster"
              type="button"
              @click="emit('clear', form.date)"
              class="px-3 py-2.5 rounded-lg text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Clear
            </button>
            <div class="flex-1" />
            <button
              type="button"
              @click="close"
              class="px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="handleSave"
              :disabled="saving"
              class="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {{ saving ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <SongPickerSheet
    v-if="form"
    v-model:show="showSongPicker"
    :songs="songs"
    :chosen-ids="form.songs.map((s) => s.songId)"
    :leader-id="form.leaderId"
    :leader-name="leaderName"
    @add="addSongs"
  />
</template>

<style scoped>
/* Same mechanics as the small-group drawer: on desktop the panel collapses its
   width rather than sliding off-screen, so the page beside it reflows. */
.lineup-drawer {
  transition: max-width 0.3s ease-out, opacity 0.3s ease;
}
.drawer-enter-from.lineup-drawer,
.drawer-leave-to.lineup-drawer {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
  margin-left: 0;
  margin-right: 0;
}
.modal-sheet-enter-active,
.modal-sheet-leave-active {
  transition: opacity 0.25s ease;
}
.modal-sheet-enter-active > div:last-child,
.modal-sheet-leave-active > div:last-child {
  transition: transform 0.25s ease;
}
.modal-sheet-enter-from,
.modal-sheet-leave-to {
  opacity: 0;
}
.modal-sheet-enter-from > div:last-child,
.modal-sheet-leave-to > div:last-child {
  transform: translateY(100%);
}
</style>
