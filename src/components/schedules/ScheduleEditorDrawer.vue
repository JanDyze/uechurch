<script setup>
/**
 * Changing one Sunday: who is on each role, the theme, and the songs.
 *
 * The lineup drawer had a song leader select and a band list built in. Those
 * are two roles among many now, so the people half is a list of the church's
 * roles in its own order, each opening the same picker. The song leader is the
 * one that behaves differently — one person, and choosing her re-keys the
 * songs — because the keys on the song list are recorded per leader.
 *
 * Songs sit below the people. Most of the roles on a schedule have nothing to
 * do with them, and the person staffing the door should not have to scroll past
 * a set list to reach it; the song leader planning hers knows to look further
 * down.
 */
import { computed, ref, watch } from 'vue'
import { ChevronDown, ChevronUp, ListMusic, Plus, Trash2, X } from '../../icons'
import { useMediaQuery } from '../../composables/useMediaQuery'
import { useFocusTrap } from '../../composables/useFocusTrap'
import { memberKey } from '../../utils/sgUtils'
import {
  findRosterMember,
  formatServiceDate,
  keyForLeader,
  rosterName,
} from '../../utils/lineupUtils'
import { BAND_ROLE, SONG_LEADER_ROLE, assignmentsOf } from '../../data/scheduleRoles'
import MemberAvatar from '../members/MemberAvatar.vue'
import SongPickerSheet from './SongPickerSheet.vue'
import PeoplePickerSheet from './PeoplePickerSheet.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  sunday: { type: Object, default: null },
  members: { type: Array, default: () => [] },
  songs: { type: Array, default: () => [] },
  roles: { type: Array, default: () => [] },
  saving: { type: Boolean, default: false },
})

const emit = defineEmits(['update:show', 'save', 'clear'])

const isMobile = useMediaQuery('(max-width: 1023px)')
const dialogRef = ref(null)
const form = ref(null)
const showSongPicker = ref(false)
/** The role whose picker is open, or null. */
const pickingRole = ref(null)

// Re-seed on open so editing one Sunday and then another never carries values
// across.
watch(
  () => [props.show, props.sunday?.date],
  ([show]) => {
    if (!show || !props.sunday) return
    const assignments = assignmentsOf(props.sunday)
    form.value = {
      date: props.sunday.date,
      theme: props.sunday.theme || '',
      songs: (props.sunday.songs || []).map((s) => ({ ...s })),
      // Every role id the service holds, including ones since removed from
      // Settings — they are carried through untouched so saving cannot lose
      // them.
      assignments: Object.fromEntries(
        Object.entries(assignments).map(([roleId, ids]) => [roleId, [...ids]])
      ),
    }
    showSongPicker.value = false
    pickingRole.value = null
  },
  { immediate: true }
)

const close = () => emit('update:show', false)
useFocusTrap(dialogRef, computed(() => props.show), close)

const peopleOn = (roleId) => form.value?.assignments[roleId] || []

const leaderId = computed(() => peopleOn(SONG_LEADER_ROLE)[0] || null)
const leaderName = computed(() => {
  const member = findRosterMember(props.members, leaderId.value)
  return member ? rosterName({ member }) : ''
})

/** Somebody's other jobs this Sunday, by name, for the picker's hint. */
const elsewhere = computed(() => {
  const map = {}
  const current = pickingRole.value?.id
  props.roles.forEach((role) => {
    if (role.id === current) return
    peopleOn(role.id).forEach((id) => {
      ;(map[id] ||= []).push(role.name)
    })
  })
  return map
})

const songById = (songId) => props.songs.find((s) => String(s.id) === String(songId)) || null

/**
 * Changing the leader re-seeds the keys, because a key belongs to the person
 * singing it. Only keys that still match the previous leader (or were never
 * set) are touched, so a deliberate transposition typed in for this service
 * survives the swap.
 */
const setLeader = (nextId) => {
  const previousId = leaderId.value
  form.value.assignments[SONG_LEADER_ROLE] = nextId ? [String(nextId)] : []
  form.value.songs = form.value.songs.map((entry) => {
    const song = songById(entry.songId)
    if (!song) return entry
    const previousKey = keyForLeader(song, previousId)
    const isUntouched = !entry.key || entry.key === previousKey
    return isUntouched ? { ...entry, key: keyForLeader(song, nextId) } : entry
  })
}

const togglePerson = (roleId, id) => {
  const current = peopleOn(roleId)
  form.value.assignments[roleId] = current.includes(id)
    ? current.filter((x) => x !== id)
    : [...current, id]
}

const removePerson = (roleId, id) => {
  if (roleId === SONG_LEADER_ROLE) return setLeader(null)
  form.value.assignments[roleId] = peopleOn(roleId).filter((x) => x !== id)
}

const onPickerToggle = (id) => togglePerson(pickingRole.value.id, id)
const onPickerChoose = (id) => setLeader(id)

const pickerOpen = computed({
  get: () => Boolean(pickingRole.value),
  set: (open) => {
    if (!open) pickingRole.value = null
  },
})

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

const handleSave = () => {
  if (props.saving || !form.value) return
  const assignments = form.value.assignments
  emit('save', {
    date: form.value.date,
    theme: form.value.theme.trim(),
    songs: form.value.songs.map((s) => ({
      ...s,
      key: (s.key || '').trim(),
      note: (s.note || '').trim(),
    })),
    assignments,
    // Mirrored so the saved object reads the same through the legacy fields
    // until the snapshot comes back; toStoredSunday derives them again anyway.
    leaderId: assignments[SONG_LEADER_ROLE]?.[0] || null,
    teamIds: assignments[BAND_ROLE] || [],
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
            : 'schedule-drawer m-3 flex h-[calc(100%-1.5rem)] w-[calc(50%-1.5rem)] shrink-0 flex-col overflow-hidden rounded-2xl border-2 border-primary/30 bg-white shadow-xl shadow-primary/25 dark:border-primary-light/30 dark:bg-gray-800 dark:shadow-primary-light/20',
        ]"
      >
        <div v-if="isMobile" class="absolute inset-0 bg-black/50" @click="close" />

        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-sunday-title"
          tabindex="-1"
          :class="[
            'flex min-h-0 flex-col',
            isMobile
              ? 'relative z-10 max-h-[92dvh] w-full rounded-t-2xl border-t border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800'
              : 'flex-1',
          ]"
        >
          <!-- Header -->
          <div
            class="flex shrink-0 items-center justify-between gap-3 rounded-t-2xl border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-gray-700"
          >
            <div class="min-w-0">
              <h3
                id="schedule-sunday-title"
                class="truncate text-lg font-semibold text-gray-900 dark:text-white"
              >
                {{ formatServiceDate(form.date) }}
              </h3>
              <p class="text-xs text-gray-500 dark:text-gray-400">Who serves, and what is sung</p>
            </div>
            <button
              @click="close"
              class="shrink-0 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              aria-label="Close"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <!-- Body -->
          <div class="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
            <!-- Theme -->
            <div>
              <label
                for="schedule-theme"
                class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Theme or occasion
              </label>
              <input
                id="schedule-theme"
                v-model="form.theme"
                type="text"
                placeholder="e.g. Thanksgiving Sunday"
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <!-- Roles. A row each: the name, who is on it, and one way in. -->
            <div>
              <p class="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Who serves</p>
              <ul class="divide-y divide-gray-100 dark:divide-gray-700/60">
                <li v-for="role in roles" :key="role.id" class="py-2.5">
                  <div class="flex items-center justify-between gap-2">
                    <p class="min-w-0 truncate text-sm font-semibold text-gray-900 dark:text-white">
                      {{ role.name }}
                    </p>
                    <button
                      type="button"
                      @click="pickingRole = role"
                      class="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary dark:text-primary-light"
                    >
                      <Plus v-if="role.id !== SONG_LEADER_ROLE || !leaderId" class="h-3.5 w-3.5" />
                      {{ role.id === SONG_LEADER_ROLE && leaderId ? 'Change' : 'Add' }}
                    </button>
                  </div>

                  <div v-if="peopleOn(role.id).length" class="mt-1.5 flex flex-wrap gap-1.5">
                    <span
                      v-for="id in peopleOn(role.id)"
                      :key="id"
                      class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 py-1 pl-1 pr-2 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                    >
                      <MemberAvatar
                        v-if="findRosterMember(members, id)"
                        :member="findRosterMember(members, id)"
                        alt=""
                        size="h-5 w-5"
                      />
                      {{ rosterName({ member: findRosterMember(members, id) }) }}
                      <button
                        type="button"
                        @click="removePerson(role.id, id)"
                        class="text-gray-400 hover:text-red-600"
                        :aria-label="`Remove ${rosterName({ member: findRosterMember(members, id) })} from ${role.name}`"
                      >
                        <X class="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>
                  <p v-else class="mt-0.5 text-xs text-gray-400 dark:text-gray-500">Nobody yet</p>
                </li>
              </ul>
            </div>

            <!-- Songs -->
            <div>
              <div class="mb-2 flex items-center justify-between gap-2">
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Songs</p>
                <button
                  type="button"
                  @click="showSongPicker = true"
                  class="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary dark:text-primary-light"
                >
                  <Plus class="h-3.5 w-3.5" />
                  Add songs
                </button>
              </div>

              <p
                v-if="!form.songs.length"
                class="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400"
              >
                <ListMusic class="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
                No songs yet. Pull them from the song list.
              </p>

              <ul v-else class="space-y-2">
                <li
                  v-for="(entry, index) in form.songs"
                  :key="`${entry.songId}-${index}`"
                  class="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40"
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
                      <p v-if="entry.category" class="text-xs text-gray-500 dark:text-gray-400">
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
                      type="text"
                      placeholder="Key"
                      :aria-label="`Key for ${entry.title}`"
                      class="w-20 shrink-0 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-center text-sm font-bold text-gray-900 focus:border-transparent focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                    <input
                      v-model="entry.note"
                      type="text"
                      placeholder="Note (e.g. opener, key change on last chorus)"
                      :aria-label="`Note for ${entry.title}`"
                      class="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <!-- Footer -->
          <div
            class="flex shrink-0 items-center gap-2 border-t border-gray-200 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:border-gray-700"
          >
            <button
              type="button"
              @click="emit('clear', form.date)"
              class="rounded-lg px-3 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Clear
            </button>
            <div class="flex-1" />
            <button
              type="button"
              @click="close"
              class="rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="handleSave"
              :disabled="saving"
              class="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
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
    :leader-id="leaderId"
    :leader-name="leaderName"
    @add="addSongs"
  />

  <PeoplePickerSheet
    v-if="form"
    v-model:show="pickerOpen"
    :role="pickingRole"
    :members="members"
    :selected-ids="pickingRole ? peopleOn(pickingRole.id) : []"
    :elsewhere="elsewhere"
    :single="pickingRole?.id === SONG_LEADER_ROLE"
    @toggle="onPickerToggle"
    @choose="onPickerChoose"
  />
</template>

<style scoped>
/* Same mechanics as the small-group drawer: on desktop the panel collapses its
   width rather than sliding off-screen, so the page beside it reflows. */
.schedule-drawer {
  transition: max-width 0.3s ease-out, opacity 0.3s ease;
}
.drawer-enter-from.schedule-drawer,
.drawer-leave-to.schedule-drawer {
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
