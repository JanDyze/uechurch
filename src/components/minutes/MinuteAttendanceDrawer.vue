<script setup>
/**
 * Who was at the meeting, edited from the minute itself.
 *
 * It used to be a read-only list: the attendance could only be set in the
 * editor drawer on the list page, before the meeting, which is the one moment
 * nobody knows who is coming. People arrive late and leave early, and the
 * person minuting is the person who can see them — so the roster belongs here,
 * beside the notes, and it saves as it is tapped.
 *
 * It matters more than a count on a page: the whole-meeting write-up takes its
 * Attendance section from this list and from nothing else, because the notes
 * never say who turned up.
 */

import { computed, ref, watch } from 'vue'
import { Check, Search, UserRound, UsersRound, X } from '../../icons'
import { getDisplayName, getFullName } from '../../utils/memberUtils'
import { memberIdOf } from '../../utils/minuteAnnotations'

const props = defineProps({
  show: { type: Boolean, default: false },
  members: { type: Array, default: () => [] },
  attendees: { type: Array, default: () => [] },
  canEdit: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  // Every tag on the roster, and the one this meeting is for. A council
  // meeting has no business listing three hundred people.
  tags: { type: Array, default: () => [] },
  tag: { type: String, default: '' },
})

const emit = defineEmits(['close', 'toggle', 'update:tag'])

const query = ref('')
watch(() => props.show, (open) => { if (!open) query.value = '' })

const present = computed(() => new Set(props.attendees.map(String)))
const isPresent = (member) => present.value.has(String(memberIdOf(member)))

const hasTag = (member, tag) =>
  (member.tags || []).some((entry) => String(entry).toLowerCase() === tag.toLowerCase()) ||
  (member.ministries || []).some((entry) => String(entry).toLowerCase() === tag.toLowerCase())

/**
 * The tags actually worth offering: ones somebody on the roster carries. A
 * list of every tag ever typed, most of them on nobody, is a list of ways to
 * empty the screen.
 */
const usableTags = computed(() =>
  props.tags.filter((tag) => props.members.some((member) => hasTag(member, tag)))
)

const inGroup = computed(() =>
  props.tag ? props.members.filter((member) => hasTag(member, props.tag)) : props.members
)

const roster = computed(() => {
  const needle = query.value.trim().toLowerCase()
  // Anyone already marked present stays listed whatever the filter says —
  // a visitor ticked before the tag was chosen must not silently vanish from
  // the list while staying in the count.
  const scope = props.members.filter(
    (member) =>
      memberIdOf(member) &&
      getFullName(member).trim() &&
      (!props.tag || hasTag(member, props.tag) || isPresent(member))
  )
  const matched = needle
    ? scope.filter((member) =>
        `${getFullName(member)} ${member.nickname || ''}`.toLowerCase().includes(needle)
      )
    : scope

  // Present first. Mid-meeting the question is "who have I got", and a list
  // that keeps the answer at the top does not have to be scrolled to read it.
  return matched.slice().sort((a, b) => {
    const byPresence = Number(isPresent(b)) - Number(isPresent(a))
    return byPresence || getDisplayName(a).localeCompare(getDisplayName(b))
  })
})

const markAllPresent = () => {
  for (const member of inGroup.value) {
    if (!isPresent(member)) emit('toggle', memberIdOf(member))
  }
}

const initials = (member) =>
  `${member.firstName?.[0] || ''}${member.lastName?.[0] || ''}`.toUpperCase() || '?'
</script>

<template>
  <Teleport to="body">
    <Transition name="attend-drawer">
      <div v-if="show" class="fixed inset-0 z-80">
        <div class="absolute inset-0 bg-black/50" @click="emit('close')" />

        <aside
          class="attend-drawer-panel absolute inset-y-0 right-0 flex w-[min(22rem,88vw)] flex-col bg-white shadow-2xl dark:bg-gray-800"
        >
          <header
            class="shrink-0 border-b border-gray-200 px-4 pb-3 pt-[max(0.875rem,env(safe-area-inset-top))] dark:border-gray-700"
          >
            <div class="flex items-center justify-between gap-2">
              <h2
                class="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white"
              >
                <UsersRound class="h-4.5 w-4.5 text-primary" />
                Attendance
                <span
                  class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold tabular-nums text-primary dark:bg-primary-light/15 dark:text-primary-light"
                >
                  {{ attendees.length }}
                </span>
              </h2>
              <button
                @click="emit('close')"
                class="-mr-1 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                aria-label="Close"
              >
                <X class="h-5 w-5" />
              </button>
            </div>

            <div v-if="canEdit" class="relative mt-2.5">
              <Search
                class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              />
              <input
                v-model="query"
                type="text"
                inputmode="search"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                placeholder="Find someone..."
                aria-label="Find someone"
                class="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none dark:border-gray-600 dark:bg-gray-900/50 dark:text-white"
              />
            </div>
            <!-- Who this meeting is for. Remembered on the minute, so the
                 next time it opens it opens on the right group. -->
            <div v-if="canEdit && usableTags.length" class="-mx-1 mt-2.5 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              <button
                @click="emit('update:tag', '')"
                :class="[
                  'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                  !tag
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300',
                ]"
              >
                Everyone
              </button>
              <button
                v-for="name in usableTags"
                :key="name"
                @click="emit('update:tag', tag === name ? '' : name)"
                :class="[
                  'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                  tag === name
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300',
                ]"
              >
                {{ name }}
              </button>
            </div>

            <div v-if="canEdit" class="mt-2 flex items-center justify-between gap-2">
              <p class="text-[11px] text-gray-400 dark:text-gray-500">
                Tap a name. Saves as you go.
              </p>
              <button
                v-if="inGroup.length && attendees.length < inGroup.length"
                @click="markAllPresent"
                class="shrink-0 text-[11px] font-semibold text-primary hover:underline dark:text-primary-light"
              >
                All {{ tag || 'present' }} ({{ inGroup.length }})
              </button>
            </div>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <button
              v-for="member in roster"
              :key="memberIdOf(member)"
              :disabled="!canEdit || saving"
              @click="emit('toggle', memberIdOf(member))"
              :aria-pressed="isPresent(member)"
              :class="[
                'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors',
                isPresent(member)
                  ? 'bg-primary/10 dark:bg-primary-light/10'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700',
                !canEdit && 'cursor-default',
              ]"
            >
              <span
                :class="[
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  isPresent(member)
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500',
                ]"
              >
                <Check v-if="isPresent(member)" class="h-4.5 w-4.5" />
                <template v-else>{{ initials(member) }}</template>
              </span>
              <!-- The name they are called, with the one on the record under
                   it. This is a recognition test taken in a room full of
                   people, the same as the attendance swipe deck. -->
              <span class="min-w-0 flex-1">
                <span
                  :class="[
                    'block truncate text-sm',
                    isPresent(member)
                      ? 'font-semibold text-gray-900 dark:text-white'
                      : 'text-gray-600 dark:text-gray-300',
                  ]"
                >
                  {{ getDisplayName(member) }}
                </span>
                <span
                  v-if="getFullName(member).trim() !== getDisplayName(member)"
                  class="block truncate text-xs text-gray-400 dark:text-gray-500"
                >
                  {{ getFullName(member) }}
                </span>
              </span>
            </button>

            <p
              v-if="!roster.length"
              class="px-3 py-10 text-center text-xs text-gray-400 dark:text-gray-500"
            >
              <UserRound class="mx-auto mb-2 h-8 w-8 opacity-40" />
              {{ query ? 'Nobody by that name.' : 'The member list is empty.' }}
            </p>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.attend-drawer-enter-active,
.attend-drawer-leave-active {
  transition: opacity 0.25s ease;
}

.attend-drawer-enter-active .attend-drawer-panel,
.attend-drawer-leave-active .attend-drawer-panel {
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}

.attend-drawer-enter-from,
.attend-drawer-leave-to {
  opacity: 0;
}

.attend-drawer-enter-from .attend-drawer-panel,
.attend-drawer-leave-to .attend-drawer-panel {
  transform: translateX(100%);
}
</style>
