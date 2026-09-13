<script setup>
import { computed, ref } from 'vue'
import { Calendar, Clock, MapPin, Users, Trash2, Edit2, CalendarClock, X } from '../../icons'
import { readExpectedAttendance, audienceLabel } from '../../utils/audience'
import { EVENT_STATUS, readEventStatus, eventStatusLabel } from '../../../lib/eventStatus'
import { getEventIcon as getIconComponent, iconForEvent } from '../../utils/eventIcons'
import { getEventTypeColor, eventTypeLabel, CALLED_OFF_BANNER } from '../../utils/eventColors'
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

// A birthday is hidden, a single date of a weekly schedule is dropped, and a
// stored event is deleted outright. Three different sizes of the same button,
// so the tooltip says which one this is.
const deleteLabel = computed(() => {
  if (props.event?.isBirthday) return 'Hide'
  const occurrence =
    (props.event?.isVirtual && props.event?.isRecurring) ||
    String(props.event?.overrideOf || '').startsWith('recurring-')
  return occurrence ? 'Delete this date' : 'Delete'
})

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

// The record read as facts, one line each, the way a person's record reads.
// Each used to be its own grey card with a tinted icon square, which put four
// boxes on a phone screen to say four short things.
const facts = computed(() => {
  const event = props.event
  if (!event) return []
  const list = [
    { key: 'date', icon: Calendar, label: 'Date', value: formatDate(event.date) },
  ]
  if (event.time) list.push({ key: 'time', icon: Clock, label: 'Time', value: event.time })
  if (event.location) {
    list.push({ key: 'location', icon: MapPin, label: 'Location', value: event.location })
  }
  if (expectedCount.value) {
    const n = expectedCount.value
    list.push({
      key: 'expected',
      icon: Users,
      label: 'Expected',
      value: `${n} ${n === 1 ? 'person' : 'people'}`,
      hint: audienceSummary.value,
    })
  }
  return list
})
</script>

<template>
  <Teleport to="body" :disabled="!isMobile">
    <Transition :name="isMobile ? 'modal-sheet' : 'drawer'">
    <div
      v-if="show && event"
      :class="[
        isMobile
          ? 'fixed inset-0 z-80 flex flex-col justify-end'
          : 'event-details-drawer ml-3 flex h-full w-[calc(50%-0.75rem)] shrink-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
      ]"
    >
      <div
        v-if="isMobile"
        class="absolute inset-0 bg-black/60 backdrop-blur-sm"
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
            ? 'relative z-10 w-full max-h-[92dvh] overflow-hidden rounded-t-2xl bg-white dark:bg-gray-800 shadow-2xl border-t border-gray-200 dark:border-gray-700'
            : 'h-full w-full'
        ]"
      >
    <!-- Header: the same shape as the People page's sheets, with the event's
         own type colour where their primary tile sits — the one place on this
         sheet a category colour earns its keep. -->
    <div class="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-linear-to-r from-primary/10 to-transparent px-4 py-3.5 dark:border-gray-700 dark:from-primary-light/10">
      <div class="flex min-w-0 items-center gap-3">
        <div
          :class="[
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-lg',
            getEventTypeColor(event.type),
          ]"
        >
          <component :is="getIconComponent(iconForEvent(event))" class="h-5.5 w-5.5" />
        </div>
        <div class="min-w-0">
          <h2
            id="event-details-drawer-title"
            :class="[
              'truncate text-base font-bold',
              isOff ? 'text-gray-500 line-through dark:text-gray-400' : 'text-gray-900 dark:text-white',
            ]"
          >
            {{ event.title }}
          </h2>
          <p class="truncate text-xs text-gray-500 dark:text-gray-400">
            {{ eventTypeLabel(event.type) }}<span v-if="event.isRecurring"> · Weekly</span><span v-if="event.isBirthday"> · Birthday</span>
          </p>
        </div>
      </div>
      <button
        @click="$emit('back')"
        aria-label="Close"
        class="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
      >
        <X class="h-5 w-5" />
      </button>
    </div>

    <!-- Content -->
    <div class="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
      <!-- Called off: the first thing anyone opening this needs to know, so it
           sits above the date rather than beside it. -->
      <div
        v-if="isOff"
        :class="['rounded-xl border px-4 py-3', CALLED_OFF_BANNER]"
      >
        <p class="flex items-center gap-2 text-sm font-bold">
          <CalendarClock class="h-4 w-4 shrink-0" />
          {{ statusHeading }}
        </p>
        <p v-if="event.postponedTo" class="mt-1 text-xs opacity-90">
          Moved to {{ formatDate(event.postponedTo) }}
        </p>
        <p v-if="event.statusNote" class="mt-1 text-sm opacity-90">
          {{ event.statusNote }}
        </p>
      </div>

      <dl class="divide-y divide-gray-100 rounded-xl border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
        <div v-for="fact in facts" :key="fact.key" class="flex items-start gap-3 px-4 py-3">
          <component :is="fact.icon" class="mt-0.5 h-4.5 w-4.5 shrink-0 text-gray-400 dark:text-gray-500" />
          <div class="min-w-0 flex-1">
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {{ fact.label }}
            </dt>
            <dd class="text-sm font-medium text-gray-900 dark:text-white">{{ fact.value }}</dd>
            <dd v-if="fact.hint" class="truncate text-xs text-gray-500 dark:text-gray-400">
              {{ fact.hint }}
            </dd>
          </div>
        </div>
      </dl>

      <div v-if="event.description" class="rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700">
        <h3 class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Description
        </h3>
        <p class="whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          {{ event.description }}
        </p>
      </div>
    </div>

    <!-- Actions: labelled at every width, sized for a thumb, and in the order
         the People page's selection bar uses — the quiet one first, the
         primary one last and widest. -->
    <div
      v-if="isEditable"
      class="flex shrink-0 items-center gap-2 border-t border-gray-200 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-gray-700"
    >
      <!-- Deleting is the other answer to "this is not happening", and a
           different one: calling off leaves the gathering on the calendar
           marked, deleting takes the date away. A weekly occurrence has no
           document of its own, so deleting it writes the override that
           stands in for it; a birthday is hidden rather than deleted. -->
      <button
        @click="$emit('delete')"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-gray-700 dark:text-gray-400 dark:hover:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-400"
        :title="deleteLabel"
        :aria-label="deleteLabel"
      >
        <Trash2 class="h-5 w-5" />
      </button>
      <!-- Calling it off is not deleting it: the gathering stays on the
           calendar, marked, so nobody turns up for something that is not
           happening. -->
      <button
        v-if="canCallOff"
        @click="$emit('status')"
        class="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary/40 px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
        :title="isOff ? 'Change or reinstate' : 'Cancel or postpone'"
      >
        <CalendarClock class="h-4 w-4 shrink-0" />
        <span class="truncate">{{ isOff ? 'Change status' : 'Call off' }}</span>
      </button>
      <button
        @click="$emit('edit')"
        class="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-colors hover:bg-primary-hover"
        :title="event.isVirtual ? 'Edit this date only' : 'Edit'"
      >
        <Edit2 class="h-4 w-4 shrink-0" />
        <span class="truncate">Edit</span>
      </button>
    </div>
      </div>
    </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.event-details-drawer {
  transition: max-width 0.3s ease-out, opacity 0.3s ease;
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
