<script setup>
import { computed, ref } from 'vue'
import { X, Plus, ArrowLeft } from '../../icons'
import EventListItem from './EventListItem.vue'
import EventBandHeader from './EventBandHeader.vue'
import EventCardSkeleton from './EventCardSkeleton.vue'
import { useFocusTrap } from '../../composables/useFocusTrap'
import { usePermissions } from '../../composables/usePermissions'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  selectedDay: {
    type: Date,
    default: null
  },
  formattedSelectedDay: {
    type: String,
    default: ''
  },
  dayEvents: {
    type: Array,
    default: () => []
  },
  holiday: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:show', 'eventClick', 'addEvent', 'back'])

// The floating button hides while this is open, so adding lives in the footer
// instead — and, like the button, only for someone who may add.
const { canManage } = usePermissions()
const canAdd = computed(() => canManage('events'))

const dialogRef = ref(null)
useFocusTrap(dialogRef, () => props.show, () => emit('back'), { trap: false })

const countLabel = computed(() => {
  const n = props.dayEvents.length
  return n ? `${n} event${n === 1 ? '' : 's'}` : 'Nothing scheduled'
})
</script>

<template>
  <!-- A panel, not a sheet: on a phone it stands where the calendar was, and
       beside it on a desktop. So it is dressed as the calendar is — one card,
       one slim strip across the top — rather than as a dialog. -->
  <div
    v-if="show"
    ref="dialogRef"
    role="dialog"
    aria-labelledby="day-events-drawer-title"
    tabindex="-1"
    class="flex h-full w-full shrink-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 lg:ml-3 lg:w-[calc(50%-0.75rem)]"
  >
    <div class="flex shrink-0 items-center gap-1 border-b border-gray-200 px-1.5 py-1.5 dark:border-gray-700 sm:px-2">
      <button
        @click="$emit('back')"
        aria-label="Back"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
      >
        <ArrowLeft class="h-5 w-5" />
      </button>
      <div class="min-w-0 flex-1 px-1">
        <h2
          id="day-events-drawer-title"
          class="truncate text-base font-semibold leading-tight text-gray-900 dark:text-white"
        >
          {{ formattedSelectedDay }}
        </h2>
        <p class="text-[11px] font-semibold text-gray-400 dark:text-gray-500">
          {{ loading ? '' : countLabel }}
        </p>
      </div>
      <button
        @click="$emit('update:show', false)"
        aria-label="Close"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
      >
        <X class="h-5 w-5" />
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <div v-if="loading" class="space-y-1 p-2">
        <EventCardSkeleton v-for="i in 3" :key="i" />
      </div>
      <template v-else>
        <EventBandHeader v-if="holiday" label="Holiday" :note="holiday.name" />
        <div v-if="dayEvents.length" class="space-y-1 p-2">
          <EventListItem
            v-for="event in dayEvents"
            :key="event.id"
            :event="event"
            @click="
              $emit('update:show', false);
              $emit('eventClick', event);
            "
          />
        </div>
        <p
          v-else
          class="p-8 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          No events scheduled for this day
        </p>
      </template>
    </div>

    <div
      v-if="canAdd"
      class="shrink-0 border-t border-gray-200 p-2 dark:border-gray-700"
    >
      <button
        @click="$emit('addEvent')"
        class="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-colors hover:bg-primary-hover"
      >
        <Plus class="h-5 w-5" />
        Add event
      </button>
    </div>
  </div>
</template>
