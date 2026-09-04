<script setup>
import { computed } from 'vue'
import { Check, FileText, Mic2, Music4, Pencil, StickyNote, Users } from '../../icons'
import { getAvatarUrl, getFullName } from '../../utils/memberUtils'
import MemberAvatar from '../members/MemberAvatar.vue'
import { memberKey } from '../../utils/sgUtils'
import { parseIso } from '../../utils/lineupUtils'

const props = defineProps({
  sunday: { type: Object, required: true },
  members: { type: Array, default: () => [] },
  // What this viewer may do here, which is a question of which of the two
  // jobs is theirs: the head assigns people, the Sunday's own leader chooses
  // its songs. Both open the same card; it should say so differently.
  canManage: { type: Boolean, default: false },
  canEditSongs: { type: Boolean, default: false },
  isMine: { type: Boolean, default: false },
  // The next service from today on: the one the whole page is really about.
  isNext: { type: Boolean, default: false },
  isPast: { type: Boolean, default: false },
  // Flips the copy button to a "Copied" tick for a moment after the parent
  // has put this service's lyrics on the clipboard.
  lyricsCopied: { type: Boolean, default: false },
})

const emit = defineEmits(['edit', 'copy-lyrics'])

const memberById = (id) =>
  props.members.find((m) => memberKey(m) === String(id) || String(m.firestoreId) === String(id)) ||
  null

const leader = computed(() => memberById(props.sunday.leaderId))
const team = computed(() =>
  (props.sunday.teamIds || []).map((id) => memberById(id)).filter(Boolean)
)

const dayNumber = computed(() => parseIso(props.sunday.date)?.getDate() ?? '')
const weekday = computed(() =>
  parseIso(props.sunday.date)?.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() ?? ''
)

const isEmpty = computed(
  () => !props.sunday.leaderId && !props.sunday.songs?.length && !props.sunday.theme
)

/** Anyone who can change something here can open it. */
const canOpen = computed(() => props.canManage || props.canEditSongs)

/**
 * What tapping the card is for, in the viewer's own terms.
 *
 * The head is looking at an empty slot and needs to staff it. A leader is
 * looking at her own Sunday and needs to choose songs for it. Same card, and
 * the wrong prompt on either would be worse than none.
 */
const prompt = computed(() => {
  if (props.canManage) {
    if (!props.sunday.leaderId) return 'Tap to assign a leader and band'
    if (!props.sunday.songs?.length) return 'Tap to plan this service'
    return ''
  }
  if (props.canEditSongs) {
    return props.sunday.songs?.length ? 'Tap to edit your songs' : 'Tap to choose your songs'
  }
  return ''
})
</script>

<template>
  <div
    :class="[
      'w-full rounded-2xl border bg-white dark:bg-gray-800 transition-colors',
      isNext
        ? 'border-primary ring-1 ring-primary/30'
        : 'border-gray-200 dark:border-gray-700',
      isPast ? 'opacity-60' : '',
      canOpen ? 'hover:border-primary/60' : '',
      isMine && !isNext ? 'border-primary/40' : '',
    ]"
  >
    <component
      :is="canOpen ? 'button' : 'div'"
      :type="canOpen ? 'button' : undefined"
      @click="canOpen && emit('edit', sunday)"
      class="block w-full text-left"
    >
      <div class="flex gap-3 p-3 sm:p-4">
        <!-- Date badge -->
        <div
          :class="[
            'shrink-0 w-12 sm:w-14 rounded-xl flex flex-col items-center justify-center py-2',
            isNext ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
          ]"
        >
          <span class="text-[10px] font-bold tracking-widest">{{ weekday }}</span>
          <span class="text-xl sm:text-2xl font-black leading-none">{{ dayNumber }}</span>
        </div>

        <div class="min-w-0 flex-1">
          <!-- Leader -->
          <div class="flex items-center gap-2">
            <template v-if="leader">
              <MemberAvatar :member="leader" alt="" size="h-7 w-7" />
              <span class="min-w-0 flex-1 text-sm font-semibold text-gray-900 dark:text-white truncate">
                {{ getFullName(leader) }}
              </span>
            </template>
            <template v-else>
              <span class="h-7 w-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                <Mic2 class="h-3.5 w-3.5 text-gray-400" />
              </span>
              <span class="min-w-0 flex-1 text-sm font-medium text-gray-400 dark:text-gray-500 truncate">
                No leader assigned
              </span>
            </template>

            <span
              v-if="isMine"
              class="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
            >
              You&rsquo;re leading
            </span>
            <span
              v-else-if="isNext"
              class="shrink-0 px-2 py-0.5 rounded-full bg-primary/10 text-primary dark:text-primary-light text-[10px] font-bold uppercase tracking-wide"
            >
              Up next
            </span>
            <Pencil v-else-if="canOpen" class="shrink-0 h-4 w-4 text-gray-300 dark:text-gray-600" />
          </div>

          <p v-if="sunday.theme" class="mt-1.5 text-xs font-semibold text-primary dark:text-primary-light truncate">
            {{ sunday.theme }}
          </p>

          <!-- Service order -->
          <p
            v-if="sunday.songs?.length"
            class="mt-2.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-gray-400"
          >
            <Music4 class="h-3 w-3" />
            {{ sunday.songs.length }} {{ sunday.songs.length === 1 ? 'song' : 'songs' }}
          </p>
          <ol v-if="sunday.songs?.length" class="mt-1 space-y-1">
            <li
              v-for="(song, index) in sunday.songs"
              :key="`${song.songId}-${index}`"
              class="flex items-baseline gap-2 text-sm"
            >
              <span class="shrink-0 w-4 text-[11px] font-bold text-gray-300 dark:text-gray-600 tabular-nums">
                {{ index + 1 }}
              </span>
              <span class="min-w-0 flex-1 text-gray-700 dark:text-gray-200 truncate">
                {{ song.title }}
                <span v-if="song.note" class="text-xs text-gray-400 dark:text-gray-500">
                  · {{ song.note }}
                </span>
              </span>
              <span
                v-if="song.key"
                class="shrink-0 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[11px] font-bold text-gray-700 dark:text-gray-200"
              >
                {{ song.key }}
              </span>
            </li>
          </ol>

          <p
            v-else-if="!isEmpty"
            class="mt-2 text-xs text-gray-400 dark:text-gray-500"
          >
            Songs not chosen yet
          </p>

          <!-- The band. Named, not a row of anonymous dots: who is playing is
               half of what a lineup is, and a player checking whether they are
               on this Sunday should not have to open the editor to find out. -->
          <template v-if="team.length">
            <p class="mt-2.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
              <Users class="h-3 w-3" /> Band
            </p>
            <div class="mt-1 flex flex-wrap gap-1">
              <span
                v-for="member in team"
                :key="memberKey(member)"
                class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 py-0.5 pl-0.5 pr-2 text-[11px] font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200"
              >
                <img
                  :src="getAvatarUrl(member)"
                  :alt="getFullName(member)"
                  class="h-4 w-4 rounded-full object-cover"
                />
                {{ getFullName(member) }}
              </span>
            </div>
          </template>

          <p
            v-else-if="!isEmpty"
            class="mt-2.5 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500"
          >
            <Users class="h-3.5 w-3.5 shrink-0" /> No band assigned yet
          </p>

          <p
            v-if="sunday.notes"
            class="mt-2 flex items-start gap-1 text-xs text-gray-500 dark:text-gray-400"
          >
            <StickyNote class="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span class="min-w-0">{{ sunday.notes }}</span>
          </p>

          <!-- What there is to do here, if anything -->
          <p
            v-if="prompt && !isPast"
            class="mt-2 text-xs font-semibold text-primary dark:text-primary-light"
          >
            {{ prompt }}
          </p>
        </div>
      </div>
    </component>

    <!-- Tech grabs the whole service's words in one go, in service order. -->
    <div
      v-if="sunday.songs?.length"
      class="flex justify-end border-t border-gray-100 dark:border-gray-700 px-3 py-1.5"
    >
      <button
        type="button"
        @click="emit('copy-lyrics', sunday)"
        class="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-primary dark:hover:text-primary-light transition-colors"
      >
        <Check v-if="lyricsCopied" class="h-3.5 w-3.5 text-emerald-500" />
        <FileText v-else class="h-3.5 w-3.5" />
        {{ lyricsCopied ? 'Lyrics copied' : 'Copy lyrics' }}
      </button>
    </div>
  </div>
</template>
