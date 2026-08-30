<script setup>
import { computed, ref } from 'vue'
import { X, ArrowLeft, Search, Check, Trash2, List, Grid, Cards, MoreVertical } from '../../icons'
import AttendanceSwipe from './AttendanceSwipe.vue'
import { useMembers } from '../../composables/useMembers'
import { useMediaQuery } from '../../composables/useMediaQuery'
import { getFullName } from '../../utils/memberUtils'
import { useFocusTrap } from '../../composables/useFocusTrap'
import { memberKey } from '../../utils/sgUtils'
import MemberAvatar from '../members/MemberAvatar.vue'

const isMobile = useMediaQuery('(max-width: 1023px)')

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  isEdit: {
    type: Boolean,
    default: false
  },
  attendanceData: {
    type: Object,
    required: true
  },
  eventData: {
    type: Object,
    default: null
  },
  // Attendance recorded against an event: the event owns the title and date,
  // so show them read-only instead of letting the two drift apart.
  detailsLocked: {
    type: Boolean,
    default: false
  },
  // 'event' | 'minute' when this drawer was opened from a generated
  // "Not recorded" row, which can only be removed by deleting its source.
  placeholderKind: {
    type: String,
    default: null
  },
  // 'drawer' slides over the list; 'page' fills a route of its own, which is
  // what taking attendance actually wants — a hundred names and a swipe deck
  // deserve the whole screen, not half of it.
  variant: {
    type: String,
    default: 'drawer'
  },
  // 'clean' | 'pending' | 'saving' | 'saved' | 'error' — marks are written as
  // they are made, so the footer reports rather than asks.
  saveState: {
    type: String,
    default: 'clean'
  }
})

const emit = defineEmits(['update:show', 'update:attendanceData', 'cancel', 'clear', 'delete-source'])

const { members } = useMembers()
const searchQuery = ref('')

// Check if creating new (no event data and not editing)
const isNewAttendance = computed(() => !props.eventData && !props.isEdit)

// Initialize form data
const formData = computed({
  get: () => {
    if (props.eventData && !props.isEdit) {
      return {
        // Provenance is decided by the page that opened this drawer and must
        // survive every edit here: rebuilding the payload from eventData alone
        // would drop it the moment anyone is toggled, and the record would
        // save as an untethered one-off.
        source: props.attendanceData.source,
        sourceId: props.attendanceData.sourceId ?? null,
        occurrenceKey: props.attendanceData.occurrenceKey ?? null,
        eventId: props.eventData.firestoreId || props.eventData.id || '',
        eventType: props.eventData.eventType || props.eventData.type || '',
        eventTitle: props.eventData.eventTitle || props.eventData.title || '',
        date: props.eventData.date || '',
        time: props.eventData.time || '',
        location: props.eventData.location || '',
        attendees: props.attendanceData.attendees || [],
        notes: props.attendanceData.notes || '',
        expectedAttendees: props.eventData.expectedAttendees || props.eventData.attendees || 0
      }
    }
    return props.attendanceData
  },
  set: (value) => {
    emit('update:attendanceData', value)
  }
})

// Update form field
const updateField = (field, value) => {
  emit('update:attendanceData', { ...formData.value, [field]: value })
}

const isFormValid = computed(() => {
  return formData.value.eventTitle && formData.value.eventTitle.trim().length > 0 &&
         formData.value.date && formData.value.date.length > 0
})

// Filter members by search
const filteredMembers = computed(() => {
  let filtered = members.value || []
  
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(member => {
      const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim().toLowerCase()
      return fullName.includes(query)
    })
  }
  
  return filtered
})

// Toggle member attendance. Marking someone present clears any absent mark —
// they turned up after all, which is the whole point of a second round.
const toggleAttendee = (memberId) => {
  const attendees = [...(formData.value.attendees || [])]
  const index = attendees.findIndex(id => String(id) === String(memberId) || id === memberId)
  if (index > -1) {
    attendees.splice(index, 1)
  } else {
    attendees.push(memberId)
    absentIds.value = absentIds.value.filter((id) => String(id) !== String(memberId))
  }
  emit('update:attendanceData', { ...formData.value, attendees })
}

// Check if member is present
const isPresent = (memberId) => {
  return (formData.value.attendees || []).some(id => String(id) === String(memberId) || id === memberId)
}

// 'browse' to hunt for a specific name, 'swipe' to go through everyone in
// order. Swipe is the better tool while the service is filling up; browsing is
// better for fixing one person afterwards. Neither replaces the other.
//
// Browsing is a single column on a phone and a card grid wherever there is
// room, so the tab is named for the shape you actually get — calling it "List"
// on a desktop described the wrong thing.
const mode = ref('browse')

const modeOptions = computed(() => [
  {
    key: 'browse',
    label: isMobile.value ? 'List' : 'Grid',
    icon: isMobile.value ? List : Grid,
  },
  { key: 'swipe', label: 'Swipe', icon: Cards },
])

// Who was explicitly marked "not here", as opposed to simply not marked yet.
// Session-only: the saved record stores who came, and asserting absence about
// someone is a claim the data model does not make. Held here rather than
// inside the deck so the list shows the same marks.
const absentIds = ref([])
const isAbsent = (memberId) => absentIds.value.some((id) => String(id) === String(memberId))

// A bare row on a phone, a bordered card once the grid kicks in. The three
// marked states have to stay legible in both, so they are picked here rather
// than nested three deep in the template.
const memberButtonClass = (member) => {
  const key = memberKey(member)
  const base =
    'w-full flex items-center gap-3 rounded-xl text-left transition-colors px-2 py-2 @md:px-3 @md:py-3 @md:border-2'
  if (isPresent(key)) {
    return `${base} bg-emerald-50 dark:bg-emerald-500/10 @md:border-emerald-400 @md:dark:border-emerald-500/40`
  }
  if (isAbsent(key)) {
    return `${base} bg-red-50/60 dark:bg-red-500/5 @md:border-red-200 @md:dark:border-red-500/20`
  }
  return `${base} hover:bg-gray-50 dark:hover:bg-gray-700/50 @md:bg-gray-50 @md:dark:bg-gray-700/50 @md:border-transparent @md:hover:bg-gray-100 @md:dark:hover:bg-gray-700`
}

const presentIds = computed({
  get: () => formData.value.attendees || [],
  set: (attendees) => emit('update:attendanceData', { ...formData.value, attendees }),
})

// Leaving is the only action anyone takes every time. Clearing what was
// recorded and deleting the underlying event are both rare and both
// irreversible, so they live behind a menu instead of sitting a thumb's width
// from Done.
const showMenu = ref(false)
const menuRef = ref(null)
useFocusTrap(menuRef, showMenu, () => { showMenu.value = false }, { trap: false })

// props.isEdit, not isEdit — the template unwraps props for you, script setup
// does not, and the bare name is simply undefined here.
const hasMenuActions = computed(() => Boolean(props.isEdit) || Boolean(props.placeholderKind))

const runMenuAction = (action) => {
  showMenu.value = false
  emit(action)
}

const SAVE_LABELS = {
  clean: 'Nothing to save yet',
  pending: 'Saving…',
  saving: 'Saving…',
  saved: 'All marks saved',
  error: 'Not saved — will retry',
}

const saveLabel = computed(() =>
  isFormValid.value ? SAVE_LABELS[props.saveState] : 'Add a title and date to start saving'
)

const handleCancel = () => {
  emit('cancel')
}

const presentCount = computed(() => formData.value.attendees?.length || 0)
const totalCount = computed(() => members.value?.length || 0)
const progressPercent = computed(() =>
  totalCount.value ? Math.round((presentCount.value / totalCount.value) * 100) : 0
)

/** "9:00 AM · Sanctuary" — the one line of context in the header. The date is
 *  the event's to state, not this screen's to repeat. */
const contextLine = computed(() => {
  const parts = []
  if (formData.value.time) parts.push(formData.value.time)
  if (formData.value.location) parts.push(formData.value.location)
  return parts.join(' · ')
})

/* --------------------------------------------------------------- chrome */
// One component serves both presentations rather than duplicating four
// hundred lines of form and member list.
const isPage = computed(() => props.variant === 'page')

const transitionName = computed(() =>
  isPage.value ? undefined : isMobile.value ? 'modal-sheet' : 'drawer'
)

const shellClass = computed(() => {
  if (isPage.value) return 'h-full w-full flex flex-col min-h-0'
  return isMobile.value
    ? 'fixed inset-0 z-80 flex flex-col justify-end'
    : 'bg-white dark:bg-gray-800 w-1/2 h-full flex flex-col shrink-0 border-l border-gray-200 dark:border-gray-700'
})

const panelClass = computed(() => {
  if (isPage.value) return 'flex flex-col min-h-0 h-full w-full'
  return isMobile.value
    ? 'relative z-10 w-full max-h-[92dvh] rounded-t-2xl bg-white dark:bg-gray-800 shadow-2xl border-t border-gray-200 dark:border-gray-700'
    : 'h-full w-full'
})
</script>

<template>
  <Teleport to="body" :disabled="isPage || !isMobile">
    <Transition :name="transitionName">
    <div v-if="show" :class="shellClass">
      <div
        v-if="!isPage && isMobile"
        class="absolute inset-0 bg-black/50"
        @click="handleCancel"
      />
      <div :class="panelClass">

      <!-- Header. Title and how far along — the two things worth permanent
           screen space. The date and type came off the event that created this
           record, so repeating them here only invited the two to drift apart.
           The header is also the gauge: it fills as the room does, the same
           way a row fills on the attendance list. -->
      <div
        :class="[
          // No overflow-hidden here: the actions menu hangs below this box on
          // `top-full`, and clipping the header swallows it. The fill cannot
          // overflow anyway - it is inset to this box and never exceeds 100%.
          'relative shrink-0 px-4 pb-3 border-b border-gray-200 dark:border-gray-700',
          // On a focus route nothing sits above this, so it owns the notch.
          isPage ? 'pt-[max(1rem,env(safe-area-inset-top))]' : 'pt-4',
        ]"
      >
        <div
          class="pointer-events-none absolute inset-y-0 left-0 bg-linear-to-r from-primary/20 to-primary/5 transition-[width] duration-500 ease-out dark:from-primary/30 dark:to-primary/10"
          :style="{ width: `${progressPercent}%` }"
        ></div>

        <div class="relative flex items-start gap-2">
          <button
            @click="handleCancel"
            :aria-label="isPage ? 'Back to attendance' : 'Close'"
            class="shrink-0 -ml-1.5 p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ArrowLeft v-if="isPage" class="h-5 w-5" />
            <X v-else class="h-5 w-5" />
          </button>

          <div class="min-w-0 flex-1">
            <!-- Recorded against an event: the event owns these, so they read. -->
            <template v-if="detailsLocked">
              <h3 class="text-base font-bold text-gray-900 dark:text-white leading-snug truncate">
                {{ formData.eventTitle }}
              </h3>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                {{ contextLine }}
              </p>
            </template>

            <!-- A one-off: the title field IS the heading, rather than a
                 labelled form repeating what the header already says. -->
            <template v-else>
              <input
                :value="formData.eventTitle"
                @input="updateField('eventTitle', $event.target.value)"
                type="text"
                placeholder="What is this gathering?"
                aria-label="Title"
                class="w-full bg-transparent text-base font-bold text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 placeholder:font-normal border-0 p-0 focus:ring-0 focus:outline-none"
              />
            </template>
          </div>

          <!-- Rare, irreversible actions live here rather than beside Done. -->
          <div v-if="hasMenuActions" class="relative shrink-0 order-last sm:order-none">
            <button
              @click="showMenu = !showMenu"
              aria-label="More actions"
              :aria-expanded="showMenu"
              class="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <MoreVertical class="h-5 w-5" />
            </button>

            <div v-if="showMenu" class="fixed inset-0 z-40" @click="showMenu = false"></div>

            <div
              v-if="showMenu"
              ref="menuRef"
              role="menu"
              tabindex="-1"
              class="absolute right-0 top-full mt-1 z-50 w-60 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl overflow-hidden"
            >
              <button
                v-if="isEdit"
                role="menuitem"
                @click="runMenuAction('clear')"
                class="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/60"
              >
                <Trash2 class="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                <span>
                  <span class="block text-sm font-medium text-gray-900 dark:text-white">
                    Clear attendance
                  </span>
                  <span class="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Wipes who was marked. The gathering stays on the list.
                  </span>
                </span>
              </button>

              <button
                v-if="placeholderKind"
                role="menuitem"
                @click="runMenuAction('delete-source')"
                class="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/60 border-t border-gray-100 dark:border-gray-700"
              >
                <Trash2 class="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                <span>
                  <span class="block text-sm font-medium text-gray-900 dark:text-white">
                    Delete {{ placeholderKind === 'minute' ? 'meeting' : 'event' }}
                  </span>
                  <span class="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Removes it from the {{ placeholderKind === 'minute' ? 'Minutes' : 'Events' }} page too.
                  </span>
                </span>
              </button>
            </div>
          </div>

          <!-- The running total, in the one place both modes can see it. The
               share leads: "62%" says how the room looks, "37 of 60" says how
               much typing is left. -->
          <div class="shrink-0 text-right">
            <p
              class="text-3xl font-bold leading-none tabular-nums text-primary dark:text-primary-light"
            >
              {{ progressPercent }}<span class="text-lg font-semibold">%</span>
            </p>
            <p class="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 tabular-nums">
              {{ presentCount }} of {{ totalCount }}
            </p>
          </div>
        </div>
      </div>

      <!-- Mode. Two ways at the same list, so it sits inline rather than
           claiming a bar of its own. -->
      <div class="shrink-0 px-4 pt-3">
        <div class="flex gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-900 w-full sm:w-56" role="tablist">
          <button
            v-for="option in modeOptions"
            :key="option.key"
            role="tab"
            :aria-selected="mode === option.key"
            @click="mode = option.key"
            :class="[
              'flex-1 h-8 flex items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition-colors',
              mode === option.key
                ? 'bg-white dark:bg-gray-700 text-primary dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400',
            ]"
          >
            <component :is="option.icon" class="h-3.5 w-3.5" />
            {{ option.label }}
          </button>
        </div>
      </div>

      <!-- Swipe -->
      <AttendanceSwipe
        v-if="mode === 'swipe'"
        v-model:presentIds="presentIds"
        v-model:absentIds="absentIds"
        :members="members"
        @done="mode = 'browse'"
        class="flex-1 min-h-0"
      />

      <template v-else>
        <!-- No "mark all" / "clear all": one tap either way rewrote a hundred
             marks with nothing to undo it, and with autosave it was committed
             before anyone could react. Marking is per person now. -->
        <div class="shrink-0 px-4 py-3">
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search members"
              class="w-full h-9 pl-9 pr-3 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-1 focus:ring-primary text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <!-- Members. One column on a phone, a card grid wherever there is
             room. The container is asked rather than the viewport, so the
             half-width desktop drawer and the full-width record page each land
             on a sensible number of columns without being told apart. -->
        <div class="@container flex-1 overflow-y-auto px-2 pb-2 @md:px-4 @md:pb-4">
          <p
            v-if="filteredMembers.length === 0"
            class="p-8 text-center text-gray-400 dark:text-gray-500 text-sm"
          >
            No members match "{{ searchQuery }}"
          </p>
          <ul
            v-else
            class="grid grid-cols-1 gap-1 @md:grid-cols-2 @md:gap-2 @3xl:grid-cols-3 @5xl:grid-cols-4"
          >
            <li v-for="member in filteredMembers" :key="memberKey(member)">
              <button
                @click="toggleAttendee(memberKey(member))"
                :aria-pressed="isPresent(memberKey(member))"
                :class="memberButtonClass(member)"
              >
                <MemberAvatar :member="member" alt="" size="w-9 h-9 @md:w-11 @md:h-11" />
                <span
                  :class="[
                    'flex-1 min-w-0 truncate text-sm',
                    isPresent(memberKey(member))
                      ? 'font-semibold text-gray-900 dark:text-white'
                      : 'text-gray-600 dark:text-gray-300',
                  ]"
                >
                  {{ getFullName(member) }}
                </span>
                <!-- Three states, not two: present, explicitly absent, and
                     not yet looked at. Collapsing the last two would hide who
                     still needs checking. -->
                <span
                  :class="[
                    'shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors',
                    isPresent(memberKey(member))
                      ? 'bg-emerald-500'
                      : isAbsent(memberKey(member))
                        ? 'bg-red-100 dark:bg-red-500/20'
                        : 'border-2 border-gray-200 dark:border-gray-600',
                  ]"
                >
                  <Check v-if="isPresent(memberKey(member))" class="h-3.5 w-3.5 text-white" />
                  <X
                    v-else-if="isAbsent(memberKey(member))"
                    class="h-3.5 w-3.5 text-red-500 dark:text-red-400"
                  />
                </span>
              </button>
            </li>
          </ul>
        </div>
      </template>

      <!-- Footer. One action, because there is only one thing left to do:
           marks are already saved, so this just leaves. Anything destructive
           is in the header menu, out of reach of a thumb aiming for Done. -->
      <div
        class="shrink-0 flex items-center gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <div class="flex-1 min-w-0 flex items-center gap-2" aria-live="polite">
          <span
            :class="[
              'h-2 w-2 rounded-full shrink-0',
              saveState === 'error'
                ? 'bg-red-500'
                : saveState === 'saved'
                  ? 'bg-emerald-500'
                  : saveState === 'clean'
                    ? 'bg-gray-300 dark:bg-gray-600'
                    : 'bg-amber-400 animate-pulse',
            ]"
          ></span>
          <span
            :class="[
              'text-xs font-medium truncate',
              saveState === 'error'
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-500 dark:text-gray-400',
            ]"
          >
            {{ saveLabel }}
          </span>
        </div>

        <button
          @click="handleCancel"
          class="shrink-0 h-11 px-6 rounded-lg bg-primary text-white text-sm font-semibold shadow-sm transition-transform active:scale-95"
        >
          Done
        </button>
      </div>
      </div>
    </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: max-width 0.3s ease-out, opacity 0.3s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
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

