<script setup>
/**
 * Tapping a highlight, and disagreeing with it.
 *
 * The matching is a guess made from a roster and a handful of rules, and it
 * will sometimes be wrong — a word that is also a name, the wrong one of two
 * people with the same first name. Highlighting that cannot be corrected is
 * worse than none, because a wrong mark on a minute reads as a fact somebody
 * checked.
 *
 * Corrections are kept on the minute, not globally. "Mark" is a name in the
 * minute where Mark took a task and a word in the one about marking the
 * anniversary, and a church-wide rule could not be right in both.
 */

import { computed, ref, watch } from 'vue'
import { Check, ExternalLink, MapPin, Search, Trash2, UserRound, X, CalendarDays } from '../../icons'
import { getDisplayName, getFullName } from '../../utils/memberUtils'
import { memberIdOf } from '../../utils/minuteAnnotations'

const props = defineProps({
  // { kind: 'person'|'date'|'place', surface, text, memberId, rect }
  mark: { type: Object, default: null },
  members: { type: Array, default: () => [] },
  canEdit: { type: Boolean, default: true },
  isMobile: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'open-member', 'link', 'dismiss'])

const picking = ref(false)
const query = ref('')
const searchRef = ref(null)

watch(
  () => props.mark,
  () => {
    picking.value = false
    query.value = ''
  }
)

const KIND_LABEL = { person: 'Person', date: 'Date', place: 'Place' }

const heading = computed(() => {
  if (!props.mark) return ''
  if (props.mark.kind === 'person') return props.mark.name || 'Someone'
  if (props.mark.kind === 'place') return props.mark.label || props.mark.text
  return props.mark.text
})

// The name on the record, under the one they are called — only when the two
// differ, so a member with no nickname does not get their name printed twice.
const formalName = computed(() =>
  props.mark?.kind === 'person' && props.mark.fullName && props.mark.fullName !== props.mark.name
    ? props.mark.fullName
    : ''
)

const matches = computed(() => {
  const needle = query.value.trim().toLowerCase()
  const people = props.members.filter((member) => memberIdOf(member) && getFullName(member).trim())
  const scored = needle
    ? people.filter((member) =>
        `${getFullName(member)} ${member.nickname || ''}`.toLowerCase().includes(needle)
      )
    : people
  return scored
    .slice()
    .sort((a, b) => getFullName(a).localeCompare(getFullName(b)))
    .slice(0, 8)
})

const startPicking = async () => {
  picking.value = true
  await Promise.resolve()
  searchRef.value?.focus()
}

// Fixed to the mark on a wide screen, and a sheet on a phone — where a popover
// anchored to a word halfway down a scrolling minute lands under the thumb
// that opened it.
const anchorStyle = computed(() => {
  const rect = props.mark?.rect
  if (!rect) return {}
  const width = 264
  const below = window.innerHeight - rect.bottom > 260
  return {
    top: `${below ? rect.bottom + 8 : rect.top - 8}px`,
    left: `${Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8))}px`,
    transform: below ? 'none' : 'translateY(-100%)',
  }
})
</script>

<template>
  <Teleport to="body">
    <div v-if="mark" class="fixed inset-0 z-90" @click="emit('close')">
      <!-- The scrim is only a scrim on a phone; on a wide screen the popover
           should not black out the minute it is describing. -->
      <div v-if="isMobile" class="absolute inset-0 bg-black/40" />

      <div
        :class="
          isMobile
            ? 'absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl dark:border-gray-700 dark:bg-gray-800'
            : 'absolute w-66 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-600 dark:bg-gray-800'
        "
        :style="isMobile ? {} : anchorStyle"
        @click.stop
      >
        <!-- What it thinks this is -->
        <div class="flex items-start gap-2.5 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
          <span
            :class="[
              'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
              mark.kind === 'person' && 'bg-primary/10 text-primary dark:bg-primary-light/15 dark:text-primary-light',
              mark.kind === 'date' && 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
              mark.kind === 'place' && 'bg-teal-100 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300',
            ]"
          >
            <UserRound v-if="mark.kind === 'person'" class="h-4 w-4" />
            <CalendarDays v-else-if="mark.kind === 'date'" class="h-4 w-4" />
            <MapPin v-else class="h-4 w-4" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-gray-900 dark:text-white">{{ heading }}</p>
            <p v-if="formalName" class="truncate text-xs text-gray-500 dark:text-gray-400">
              {{ formalName }}
            </p>
            <p class="truncate text-xs text-gray-400 dark:text-gray-500">
              {{ KIND_LABEL[mark.kind] }} · read from &ldquo;{{ mark.text }}&rdquo;
            </p>
          </div>
          <button
            @click="emit('close')"
            class="-mr-1 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            aria-label="Close"
          >
            <X class="h-4 w-4" />
          </button>
        </div>

        <!-- Choosing a different person -->
        <div v-if="picking" class="p-2">
          <div class="mb-2 flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-1.5 focus-within:border-primary dark:border-gray-600">
            <Search class="h-4 w-4 shrink-0 text-gray-400" />
            <input
              ref="searchRef"
              v-model="query"
              type="text"
              placeholder="Search people..."
              class="min-w-0 flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none dark:text-white"
            />
          </div>
          <div class="max-h-56 overflow-y-auto">
            <button
              v-for="member in matches"
              :key="memberIdOf(member)"
              @click="emit('link', { surface: mark.surface, memberId: memberIdOf(member) })"
              class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <UserRound class="h-4 w-4 shrink-0 text-gray-400" />
              <span class="min-w-0 flex-1 truncate">{{ getDisplayName(member) }}</span>
              <Check
                v-if="memberIdOf(member) === mark.memberId"
                class="ml-auto h-4 w-4 shrink-0 text-primary"
              />
            </button>
            <p v-if="!matches.length" class="px-2.5 py-3 text-center text-xs text-gray-400">
              Nobody by that name.
            </p>
          </div>
        </div>

        <!-- What can be done about it -->
        <div v-else class="p-1.5">
          <button
            v-if="mark.kind === 'person' && mark.memberId"
            @click="emit('open-member', mark.memberId)"
            class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <ExternalLink class="h-4 w-4 shrink-0 text-gray-400" />
            <span>Open their profile</span>
          </button>

          <button
            v-if="canEdit && mark.kind === 'person'"
            @click="startPicking"
            class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <UserRound class="h-4 w-4 shrink-0 text-gray-400" />
            <span>This is someone else…</span>
          </button>

          <button
            v-if="canEdit"
            @click="emit('dismiss', { surface: mark.surface, kind: mark.kind })"
            class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <Trash2 class="h-4 w-4 shrink-0" />
            <span>
              Not a {{ mark.kind === 'person' ? 'name' : mark.kind }} — remove
            </span>
          </button>

          <p v-if="canEdit" class="px-2.5 pb-1 pt-2 text-xs text-gray-400 dark:text-gray-500">
            Applies to &ldquo;{{ mark.text }}&rdquo; throughout these minutes.
          </p>
        </div>
      </div>
    </div>
  </Teleport>
</template>
