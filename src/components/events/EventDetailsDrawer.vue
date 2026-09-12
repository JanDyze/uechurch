<script setup>
import { computed, ref } from 'vue'
import { ArrowLeft, Calendar, Clock, MapPin, Users, Trash2, Edit2, CalendarClock } from '../../icons'
import { readExpectedAttendance, audienceLabel } from '../../utils/audience'
import { EVENT_STATUS, readEventStatus, eventStatusLabel } from '../../../lib/eventStatus'
import { getEventIcon as getIconComponent } from '../../utils/eventIcons'
import { getEventTypeColor } from '../../utils/eventColors'
import { useMediaQuery } from '../../composables/useMediaQuery'
import { useFocusTrap } from '../../composables/useFocusTrap'

const isMobile = useMediaQuery('(max-width: 1023px)')

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  event: {
    type: Object,
    default: null
  },
  members: {
    type: Array,
    default: () => []
  },
  isEditable: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:show', 'edit', 'delete', 'status', 'back'])

// Whether this is still on. A birthday cannot be called off — it is generated
// from a member's date of birth, and there is nothing to cancel.
const status = computed(() => readEventStatus(props.event))
const isOff = computed(() => status.value !== EVENT_STATUS.SCHEDULED)
const canCallOff = computed(() => Boolean(props.event) && !props.event.isBirthday)
const statusHeading = computed(() => eventStatusLabel(status.value))

// Recounted from the roster every time this opens rather than read off the
// event, so an event tagged for the choir reports the choir as it stands today.
// An event saved before audiences existed has no tags and keeps the number it
// was given; a birthday, which has neither and expects nobody, shows nothing.
const audienceSummary = computed(() =>
  audienceLabel(props.event?.audienceTags || [], props.event?.excludeTags || [])
)
const expectedCount = computed(() =>
  props.event?.isBirthday ? 0 : readExpectedAttendance(props.event, props.members)
)

const dialogRef = ref(null)
useFocusTrap(dialogRef, () => props.show, () => emit('back'))

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
</script>

<template>
  <Teleport to="body" :disabled="!isMobile">
    <Transition :name="isMobile ? 'modal-sheet' : 'drawer'">
    <div
      v-if="show && event"
      :class="[
        isMobile
          ? 'fixed inset-0 z-80 flex flex-col justify-end'
          : 'event-details-drawer m-2 md:m-3 rounded-2xl border-2 border-primary/30 dark:border-primary-light/30 bg-white dark:bg-gray-800 w-[calc(100%-1rem)] md:w-[calc(50%-1.5rem)] h-[calc(100%-1rem)] md:h-[calc(100%-1.5rem)] flex flex-col shrink-0 shadow-xl shadow-primary/25 dark:shadow-primary-light/20 transition-all duration-300'
      ]"
    >
      <div
        v-if="isMobile"
        class="absolute inset-0 bg-black/50"
        @click="$emit('back')"
      />
      <div
        ref="dialogRef"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-details-drawer-title"
        tabindex="-1"
        :class="[
          'flex flex-col min-h-0',
          isMobile
            ? 'relative z-10 w-full max-h-[92dvh] rounded-t-2xl bg-white dark:bg-gray-800 shadow-2xl border-t border-gray-200 dark:border-gray-700'
            : 'h-full w-full'
        ]"
      >
    <!-- Header with Back Button -->
    <div class="shrink-0 bg-linear-to-r from-primary/10 to-transparent dark:from-primary-light/10 dark:to-transparent rounded-t-2xl border-b border-primary/20 dark:border-primary-light/20 px-4 sm:px-5 py-4">
      <button
        @click="$emit('back')"
        class="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-3"
      >
        <ArrowLeft class="h-4 w-4" />
        <span class="text-sm font-medium">Back to Events</span>
      </button>

      <div class="flex items-center gap-4">
        <div
          :class="[
            'w-14 h-14 rounded-xl flex items-center justify-center shadow-lg shrink-0',
            getEventTypeColor(event.type),
          ]"
        >
          <component :is="getIconComponent(event.icon || 'Calendar')" class="h-7 w-7" />
        </div>
        <div class="flex-1 min-w-0">
          <h2 id="event-details-drawer-title" class="text-xl font-bold text-gray-900 dark:text-white truncate">
            {{ event.title }}
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 capitalize">
            {{ event.type }} Event
          </p>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
      <!-- Called off: the first thing anyone opening this needs to know, so it
           sits above the date rather than beside it. -->
      <div
        v-if="isOff"
        class="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-500/10"
      >
        <p class="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-300">
          <CalendarClock class="h-4 w-4 shrink-0" />
          {{ statusHeading }}
        </p>
        <p v-if="event.postponedTo" class="mt-1 text-xs text-amber-700 dark:text-amber-300/80">
          Moved to {{ formatDate(event.postponedTo) }}
        </p>
        <p v-if="event.statusNote" class="mt-1 text-sm text-amber-700 dark:text-amber-300/80">
          {{ event.statusNote }}
        </p>
      </div>

      <!-- Date & Time Card -->
      <div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-primary/10 dark:bg-primary-light/10 rounded-lg">
            <Calendar class="h-5 w-5 text-primary dark:text-primary-light" />
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">Date</p>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ formatDate(event.date) }}
            </p>
          </div>
        </div>
        
        <div class="flex items-center gap-3">
          <div class="p-2 bg-primary/10 dark:bg-primary-light/10 rounded-lg">
            <Clock class="h-5 w-5 text-primary dark:text-primary-light" />
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">Time</p>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ event.time }}
            </p>
          </div>
        </div>
      </div>

      <!-- Location Card -->
      <div v-if="event.location" class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-primary/10 dark:bg-primary-light/10 rounded-lg">
            <MapPin class="h-5 w-5 text-primary dark:text-primary-light" />
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400">Location</p>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ event.location }}
            </p>
          </div>
        </div>
      </div>

      <!-- Attendees Card -->
      <div v-if="expectedCount" class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-primary/10 dark:bg-primary-light/10 rounded-lg">
            <Users class="h-5 w-5 text-primary dark:text-primary-light" />
          </div>
          <div class="min-w-0">
            <p class="text-xs text-gray-500 dark:text-gray-400">Expected Attendees</p>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ expectedCount }} {{ expectedCount === 1 ? 'person' : 'people' }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
              {{ audienceSummary }}
            </p>
          </div>
        </div>
      </div>

      <!-- Description -->
      <div v-if="event.description" class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
        <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Description
        </h3>
        <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          {{ event.description }}
        </p>
      </div>

    </div>

    <!-- Footer Actions -->
    <div v-if="isEditable" class="shrink-0 bg-linear-to-r from-primary/10 to-transparent dark:from-primary-light/10 dark:to-transparent rounded-b-2xl border-t border-primary/20 dark:border-primary-light/20 px-4 sm:px-5 py-4">
      <div class="flex justify-end gap-2">
        <!-- Calling it off is not deleting it: the gathering stays on the
             calendar, marked, so nobody turns up for something that is not
             happening. -->
        <button
          v-if="canCallOff"
          @click="$emit('status')"
          :class="[
            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isOff
              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/30'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600',
          ]"
          :title="isOff ? 'Change or reinstate' : 'Cancel or postpone'"
        >
          <CalendarClock class="h-5 w-5" />
          <span class="hidden sm:inline">{{ isOff ? 'Change' : 'Call off' }}</span>
        </button>
        <button
          @click="$emit('edit')"
          class="p-2 text-white bg-primary dark:bg-primary-light rounded-lg hover:bg-primary-hover dark:hover:bg-[#1a9aab] transition-colors shadow-lg shadow-primary/25 dark:shadow-primary-light/25"
          :title="event.isVirtual ? 'Override' : 'Edit'"
          :aria-label="event.isVirtual ? 'Override' : 'Edit'"
        >
          <Edit2 class="h-5 w-5" />
        </button>
        <!-- Only where there is something to delete. A weekly occurrence is
             generated from a schedule and has no document of its own, so it is
             called off above rather than deleted here; a birthday is hidden. -->
        <button
          v-if="!event.isVirtual || event.isBirthday"
          @click="$emit('delete')"
          class="p-2 text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors shadow-lg shadow-red-500/25"
          :title="event.isBirthday ? 'Hide' : 'Delete'"
          :aria-label="event.isBirthday ? 'Hide' : 'Delete'"
        >
          <Trash2 class="h-5 w-5" />
        </button>
      </div>
    </div>
      </div>
    </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.event-details-drawer {
  transition: max-width 0.3s ease-out, opacity 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}

.drawer-enter-from.event-details-drawer,
.drawer-leave-to.event-details-drawer {
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
