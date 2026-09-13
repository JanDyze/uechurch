<script setup>
import { computed, ref, watch } from 'vue'
import { X, Check, CalendarClock } from '../../icons'
import { useFocusTrap } from '../../composables/useFocusTrap'
import { EVENT_STATUS, readEventStatus } from '../../../lib/eventStatus'
import { CALLED_OFF_BANNER } from '../../utils/eventColors'

// One sheet for "this is not happening", opened from the calendar and from the
// attendance list alike, so the answer means the same thing on both.
//
// Three of the four choices are about the gathering itself and one is not:
// skipping is a decision about the paperwork — the gathering happened, nobody
// is going to count it, and it should stop being asked for. Keeping it here
// rather than in a menu of its own is deliberate: at the moment somebody is
// looking at a row they are not going to record, "it was cancelled", "it moved"
// and "we are not counting this one" are the same decision being made once.

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  /** The event, occurrence or attendance row being marked. */
  event: {
    type: Object,
    default: null,
  },
  /** Whether to offer skipping — only where attendance is being recorded. */
  allowSkip: {
    type: Boolean,
    default: false,
  },
  /**
   * Whether cancelling and postponing apply at all. A meeting belongs to the
   * minutes rather than the calendar, and a gathering already saved on the
   * attendance side has no event document to write a status to — both can
   * still be left out of the count.
   */
  allowStatus: {
    type: Boolean,
    default: true,
  },
  /** True when this row is already being skipped. */
  skipped: {
    type: Boolean,
    default: false,
  },
  /** A write is in flight; every control here would otherwise fire twice. */
  busy: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'apply', 'skip', 'unskip'])

const status = computed(() => (props.event ? readEventStatus(props.event) : EVENT_STATUS.SCHEDULED))
const isOff = computed(() => status.value !== EVENT_STATUS.SCHEDULED)

const choice = ref(EVENT_STATUS.CANCELLED)
const note = ref('')
const movedTo = ref('')

// Reopening on a different gathering must not carry the last one's reason
// across — a note reading "typhoon" on the wrong service is worse than none.
watch(
  () => [props.show, props.event],
  () => {
    if (!props.show) return
    choice.value = isOff.value ? status.value : EVENT_STATUS.CANCELLED
    note.value = props.event?.statusNote || ''
    movedTo.value = props.event?.postponedTo || ''
  },
  { immediate: true }
)

const title = computed(() => props.event?.title || props.event?.eventTitle || 'This gathering')

const options = computed(() => [
  {
    key: EVENT_STATUS.CANCELLED,
    label: 'Cancelled',
    hint: 'It is not happening at all',
  },
  {
    key: EVENT_STATUS.POSTPONED,
    label: 'Postponed',
    hint: 'Not on this date — moved, or moving',
  },
])

const apply = () => {
  if (props.busy) return
  emit('apply', {
    status: choice.value,
    note: note.value.trim(),
    movedTo: choice.value === EVENT_STATUS.POSTPONED ? movedTo.value : '',
  })
}

const reinstate = () => {
  if (props.busy) return
  emit('apply', { status: EVENT_STATUS.SCHEDULED, note: '', movedTo: '' })
}

const dialogRef = ref(null)
useFocusTrap(dialogRef, () => props.show, () => emit('close'))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <!-- A sheet on a phone, a centred dialog on a desktop: this is reached
           from a row under a thumb far more often than from a mouse. -->
      <div
        v-if="show && event"
        class="fixed inset-0 z-120 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        @click.self="emit('close')"
      >
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-status-title"
          tabindex="-1"
          class="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-gray-200 bg-white shadow-2xl sm:max-w-md sm:rounded-2xl dark:border-gray-700 dark:bg-gray-800"
          @click.stop
        >
          <!-- The People page's sheet header: a tinted strip, the action's
               icon in a primary tile, what it is about beneath. -->
          <div
            class="flex items-center justify-between gap-3 border-b border-gray-200 bg-linear-to-r from-primary/10 to-transparent px-4 py-3.5 dark:border-gray-700 dark:from-primary-light/10"
          >
            <div class="flex min-w-0 items-center gap-3">
              <div class="shrink-0 rounded-xl bg-primary p-2.5 shadow-lg shadow-primary/30">
                <CalendarClock class="h-5 w-5 text-white" />
              </div>
              <div class="min-w-0">
                <h3
                  id="event-status-title"
                  class="truncate text-base font-bold text-gray-900 dark:text-white"
                >
                  {{ title }}
                </h3>
                <p class="truncate text-xs text-gray-500 dark:text-gray-400">
                  {{ event.date }}<span v-if="event.time"> · {{ event.time }}</span>
                </p>
              </div>
            </div>
            <button
              @click="emit('close')"
              aria-label="Close"
              class="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <div v-if="allowStatus" class="space-y-3 px-4 py-4">
            <!-- Already marked: say so plainly, and put the way back first. -->
            <div
              v-if="isOff"
              :class="['rounded-lg border px-3 py-2 text-xs', CALLED_OFF_BANNER]"
            >
              Currently marked
              <span class="font-semibold">{{ status === 'cancelled' ? 'cancelled' : 'postponed' }}</span
              ><span v-if="event.statusNote"> — {{ event.statusNote }}</span>
            </div>

            <!-- The sort sheet's rows: tinted when chosen, a tick at the end -->
            <div class="space-y-1">
              <button
                v-for="option in options"
                :key="option.key"
                @click="choice = option.key"
                :aria-pressed="choice === option.key"
                :class="[
                  'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
                  choice === option.key
                    ? 'bg-primary/10 dark:bg-primary-light/15'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700/60',
                ]"
              >
                <span class="min-w-0 flex-1">
                  <span
                    :class="[
                      'block text-sm font-semibold',
                      choice === option.key ? 'text-primary' : 'text-gray-900 dark:text-white',
                    ]"
                  >
                    {{ option.label }}
                  </span>
                  <span class="block text-xs text-gray-500 dark:text-gray-400">
                    {{ option.hint }}
                  </span>
                </span>
                <Check v-if="choice === option.key" class="h-4.5 w-4.5 shrink-0 text-primary" />
              </button>
            </div>

            <!-- Optional on purpose: "postponed, date to follow" is a real and
                 common answer, and demanding a date would only get a made-up
                 one. -->
            <label v-if="choice === 'postponed'" class="block">
              <span class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                Moved to <span class="font-normal text-gray-400">(if known)</span>
              </span>
              <input
                v-model="movedTo"
                type="date"
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </label>

            <label class="block">
              <span class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                Reason <span class="font-normal text-gray-400">(optional)</span>
              </span>
              <input
                v-model="note"
                type="text"
                maxlength="120"
                placeholder="Typhoon, venue unavailable…"
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </label>

            <p class="text-[11px] leading-snug text-gray-400 dark:text-gray-500">
              It stays on the calendar, marked, so nobody turns up for it — and it stops being
              asked for on Attendance.
            </p>
          </div>

          <!-- Skipping is not a fact about the gathering, so it sits apart from
               the choices above rather than among them. -->
          <div
            v-if="allowSkip"
            class="border-t border-gray-200 px-4 py-3 dark:border-gray-700"
          >
            <button
              v-if="!skipped"
              :disabled="busy"
              @click="busy || emit('skip')"
              class="w-full rounded-lg border border-dashed border-gray-300 px-3 py-2 text-left text-xs text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50"
            >
              <span class="block font-semibold">It happened — just don't count it</span>
              <span class="block text-gray-400 dark:text-gray-500">
                Leaves the calendar alone and stops Attendance asking
              </span>
            </button>
            <button
              v-else
              :disabled="busy"
              @click="busy || emit('unskip')"
              class="w-full rounded-lg border border-dashed border-gray-300 px-3 py-2 text-left text-xs text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50"
            >
              <span class="block font-semibold">Ask me for this one again</span>
              <span class="block text-gray-400 dark:text-gray-500">
                It goes back on the list to record
              </span>
            </button>
          </div>

          <!-- Thumb-sized, and in the selection bar's colours: the outlined
               button is the other way out, the filled one is the answer. -->
          <div
            class="flex items-center gap-2 border-t border-gray-200 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-gray-700"
          >
            <button
              v-if="isOff && allowStatus"
              :disabled="busy"
              @click="reinstate"
              class="inline-flex h-11 shrink-0 items-center rounded-lg border border-primary/40 px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
            >
              It's back on
            </button>
            <button
              v-else
              @click="emit('close')"
              class="inline-flex h-11 shrink-0 items-center rounded-lg border border-gray-200 px-4 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Close
            </button>

            <button
              v-if="allowStatus"
              :disabled="busy"
              @click="apply"
              class="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
              {{ busy ? 'Saving…' : isOff ? 'Update' : 'Mark it' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-active > div,
.modal-leave-active > div {
  transition: transform 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

@media (max-width: 639px) {
  .modal-enter-from > div,
  .modal-leave-to > div {
    transform: translateY(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .modal-enter-active,
  .modal-leave-active,
  .modal-enter-active > div,
  .modal-leave-active > div {
    transition: none;
  }
}
</style>
