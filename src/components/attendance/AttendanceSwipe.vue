<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Check, X, RotateCcw, Users, ArrowLeft, ArrowRight, ClipboardCheck } from '../../icons'
import { getFullName } from '../../utils/memberUtils'
import { memberKey } from '../../utils/sgUtils'
import MemberAvatar from '../members/MemberAvatar.vue'

// Swipe-to-record: one member at a time, right for present, left for absent.
//
// Built around how attendance is actually taken during a service rather than
// after it. People arrive late, so a single pass is never the whole picture —
// once the deck is empty the absent pile can be dealt again as a fresh round,
// as many times as the service runs. Nobody has to hunt back through a list of
// a hundred names to correct one person.
//
// Anyone the user skips stays undecided rather than being assumed absent:
// "not marked" and "not here" are different facts, and quietly conflating them
// would understate attendance.

const props = defineProps({
  members: { type: Array, default: () => [] },
  /** Member ids already marked present — the saved `attendees` array. */
  presentIds: { type: Array, default: () => [] },
  /**
   * Marked absent. Session-only and shared with the list rather than kept in
   * here: an explicit "not here" is worth seeing in both views, and it is what
   * makes another round possible. Never saved — the record stores who came.
   */
  absentIds: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:presentIds', 'update:absentIds', 'done'])

/* ------------------------------------------------------------------ state */

// The app-wide member identity (sgUtils.memberKey), NOT firestoreId. Members
// carry a legacy numeric `id` distinct from their document id, and the list
// half of this screen keys on that one — using a different identity here meant
// the two halves wrote different values into the same `attendees` array and
// neither could see the other's marks.
const idOf = memberKey

const present = ref(new Set(props.presentIds.map(String)))
const absent = ref(new Set(props.absentIds.map(String)))
const round = ref(1)
// Deck order for this round, as member ids
const deck = ref([])
const history = ref([])

const memberById = computed(() => {
  const map = new Map()
  props.members.forEach((m) => map.set(String(idOf(m)), m))
  return map
})

const buildDeck = (ids) => {
  deck.value = ids.filter((id) => memberById.value.has(String(id))).map(String)
  history.value = []
}

/** First round deals everyone not already recorded present. */
const startFirstRound = () => {
  round.value = 1
  // Anyone already decided either way — in the list, or on a previous visit to
  // this deck — is not dealt again.
  const decided = new Set([...present.value, ...absent.value])
  buildDeck(props.members.map((m) => String(idOf(m))).filter((id) => !decided.has(id)))
}

onMounted(startFirstRound)

// A changed roster (a member added mid-session) should not strand the deck
watch(
  () => props.members.length,
  () => {
    if (!deck.value.length && round.value === 1 && !history.value.length) startFirstRound()
  }
)

const current = computed(() => memberById.value.get(deck.value[0]) || null)
const upNext = computed(() => memberById.value.get(deck.value[1]) || null)
const remaining = computed(() => deck.value.length)

const undecided = computed(() => {
  const decided = new Set([...present.value, ...absent.value])
  return props.members.filter((m) => !decided.has(String(idOf(m)))).length - remaining.value
})

const publish = () => {
  emit('update:presentIds', [...present.value])
  emit('update:absentIds', [...absent.value])
}

/* ------------------------------------------------------------- decisions */

// The card leaves before the decision lands. A button press and a swipe should
// feel like the same act — tapping used to make the card vanish and the next
// one appear, which read as a glitch rather than a choice.
const EXIT_MS = 260

// 'present' | 'absent' | 'skip' while a card is flying out
const exiting = ref(null)
// The direction an undone card returns from, and whether it has started moving
const enterFrom = ref(null)
const entering = ref(false)

let exitTimer = null
let enterTimer = null

/** True while a card is mid-flight — further input would race the animation. */
const animating = computed(() => Boolean(exiting.value))

const commit = (verdict) => {
  const id = deck.value[0]
  if (!id) return

  history.value.push({ id, verdict, round: round.value })
  if (verdict === 'present') {
    present.value.add(id)
    absent.value.delete(id)
  } else if (verdict === 'absent') {
    absent.value.add(id)
    present.value.delete(id)
  }
  // 'skip' records nothing, leaving the member undecided

  deck.value = deck.value.slice(1)
  present.value = new Set(present.value)
  absent.value = new Set(absent.value)
  publish()
  resetDrag()
}

const decide = (verdict) => {
  if (!current.value || animating.value) return
  exiting.value = verdict
  clearTimeout(exitTimer)
  exitTimer = setTimeout(() => {
    commit(verdict)
    // Nothing to reset: the next member renders into a element of its own
    // (see the :key on the card), so it starts at rest by construction.
    exiting.value = null
  }, EXIT_MS)
}

const undo = () => {
  if (animating.value) return
  const last = history.value.pop()
  if (!last) return
  if (last.verdict === 'present') present.value.delete(last.id)
  if (last.verdict === 'absent') absent.value.delete(last.id)
  present.value = new Set(present.value)
  absent.value = new Set(absent.value)
  deck.value = [last.id, ...deck.value]
  publish()
  resetDrag()

  // Put the restored card back where it flew off to, then let it travel home,
  // so undo reads as the reverse of the decision rather than a card appearing
  // out of nowhere.
  enterFrom.value = last.verdict
  entering.value = false
  clearTimeout(enterTimer)
  // Two frames, not one. A single rAF runs before the browser paints, so Vue's
  // two DOM writes land in the same frame and the browser only ever sees the
  // final position — no transition. The first frame commits the off-screen
  // start, the second releases it.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      entering.value = true
      enterTimer = setTimeout(() => {
        enterFrom.value = null
        entering.value = false
      }, EXIT_MS)
    })
  })
}

/** Deal the absent pile again — the late arrivals. */
const nextRound = () => {
  const pile = [...absent.value]
  if (!pile.length) return
  round.value += 1
  absent.value = new Set()
  publish()
  buildDeck(pile)
}

/** Deal only the people never marked either way. */
const reviewUndecided = () => {
  const decided = new Set([...present.value, ...absent.value])
  const pile = props.members.map((m) => String(idOf(m))).filter((id) => !decided.has(id))
  if (!pile.length) return
  buildDeck(pile)
}

/* ----------------------------------------------------------------- drag */

const THRESHOLD = 96
// Down needs a longer pull than left or right. Skipping is the rarer, less
// committal choice, and a hand travelling sideways drifts downward on the way.
const THRESHOLD_DOWN = 128
const dragX = ref(0)
const dragY = ref(0)
const dragging = ref(false)
let pointerId = null
let startX = 0
let startY = 0

const resetDrag = () => {
  dragX.value = 0
  dragY.value = 0
  dragging.value = false
  pointerId = null
}

/** Which way this drag is currently leaning, if far enough to read. */
const dragVerdict = (dx, dy, minX = THRESHOLD, minDown = THRESHOLD_DOWN) => {
  // Down only counts when it clearly beats the sideways travel, so a sloppy
  // right-swipe is never mistaken for a skip.
  if (dy > minDown && dy > Math.abs(dx)) return 'skip'
  if (dx > minX) return 'present'
  if (dx < -minX) return 'absent'
  return null
}

const onPointerDown = (event) => {
  if (!current.value || animating.value) return
  pointerId = event.pointerId
  startX = event.clientX
  startY = event.clientY
  dragging.value = true
  event.currentTarget.setPointerCapture?.(pointerId)
}

const onPointerMove = (event) => {
  if (!dragging.value || event.pointerId !== pointerId) return
  dragX.value = event.clientX - startX
  const dy = event.clientY - startY
  // Upward leads nowhere, so it drags heavy rather than being pinned — the
  // card still answers the finger, it just will not pretend to offer anything.
  dragY.value = dy < 0 ? dy / 4 : dy
}

const onPointerUp = (event) => {
  if (!dragging.value || event.pointerId !== pointerId) return
  dragging.value = false
  const verdict = dragVerdict(dragX.value, dragY.value)
  if (verdict) decide(verdict)
  else {
    dragX.value = 0
    dragY.value = 0
  }
}

// Far enough that the card is well clear of any phone before it is dropped.
const FLY = 640

const cardStyle = computed(() => {
  // Leaving, by swipe or by button — both animate identically on purpose.
  if (exiting.value) {
    const x = exiting.value === 'present' ? FLY : exiting.value === 'absent' ? -FLY : 0
    const y = exiting.value === 'skip' ? FLY : 0
    return {
      transform: `translate(${x}px, ${y}px) rotate(${x / 22}deg)`,
      opacity: 0,
      transition: `transform ${EXIT_MS}ms cubic-bezier(.3,.1,.4,1), opacity ${EXIT_MS}ms ease-in`,
    }
  }

  // Coming back from an undo: placed where it left with no transition, then
  // released on the next frame so it travels home.
  if (enterFrom.value) {
    const x = enterFrom.value === 'present' ? FLY : enterFrom.value === 'absent' ? -FLY : 0
    const y = enterFrom.value === 'skip' ? FLY : 0
    return entering.value
      ? {
          transform: 'translate(0, 0) rotate(0deg)',
          transition: `transform ${EXIT_MS}ms cubic-bezier(.2,.8,.3,1)`,
        }
      : { transform: `translate(${x}px, ${y}px) rotate(${x / 22}deg)`, transition: 'none' }
  }

  return {
    // Rotation follows the horizontal only: a card tilting as it is pulled
    // down would read as another sideways verdict.
    transform: `translate(${dragX.value}px, ${dragY.value}px) rotate(${dragX.value / 22}deg)`,
    transition: dragging.value ? 'none' : 'transform 220ms cubic-bezier(.2,.8,.3,1)',
  }
})

// How far the top card has committed, 0 to 1.
const departure = computed(() => {
  if (exiting.value) return 1
  return Math.min(
    1,
    Math.max(Math.abs(dragX.value) / THRESHOLD, Math.max(0, dragY.value) / THRESHOLD_DOWN)
  )
})

// The card behind only scales. No sliding, and it never reaches full size or
// full opacity: these are positional elements, not travelling cards — the
// member behind never actually moves into the front slot, the two elements
// just re-render with different people. Animating it as though it rose into
// place would claim a handoff that does not happen, and a second full-size
// card reads as the one you are deciding on.
const NEXT_SCALE_MIN = 0.92
const NEXT_SCALE_MAX = 0.97

// The card behind is keyed by member, so when the deck advances it is a brand
// new element and would otherwise simply pop into existence. This eases it in.
const nextArriving = ref(false)
let arriveTimer = null

watch(
  () => (upNext.value ? idOf(upNext.value) : null),
  (id) => {
    if (!id) return
    nextArriving.value = true
    clearTimeout(arriveTimer)
    // Two frames for the same reason undo needs them: one to paint the small,
    // transparent start, the next to release it.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        nextArriving.value = false
      })
    })
  },
  { immediate: true }
)

const NEXT_ARRIVE_MS = 320

const nextCardStyle = computed(() => {
  if (nextArriving.value) {
    return { transform: 'scale(0.84)', opacity: 0, transition: 'none' }
  }
  return {
    transform: `scale(${NEXT_SCALE_MIN + (NEXT_SCALE_MAX - NEXT_SCALE_MIN) * departure.value})`,
    opacity: 0.45 + 0.25 * departure.value,
    // Eased out rather than linear, and a touch slower than the card leaving,
    // so arriving reads as settling rather than snapping.
    transition: dragging.value
      ? 'none'
      : `transform ${NEXT_ARRIVE_MS}ms cubic-bezier(.2,.8,.3,1), opacity ${NEXT_ARRIVE_MS}ms ease-out`,
  }
})

// The verdict overlay, so the decision is legible before the finger lifts
// rather than being a guess. Reads at a much shorter distance than the commit
// threshold — it is a hint, not the decision.
const intent = computed(() => dragVerdict(dragX.value, dragY.value, 24, 32))

const intentOpacity = computed(() => {
  if (intent.value === 'skip') return Math.min(1, dragY.value / THRESHOLD_DOWN)
  return Math.min(1, Math.abs(dragX.value) / THRESHOLD)
})

const INTENT_LABELS = { present: 'Present', absent: 'Absent', skip: 'Skip' }
const INTENT_CLASSES = {
  present: 'border-emerald-500 text-emerald-500 bg-emerald-50/80 dark:bg-emerald-500/10 rotate-[-12deg]',
  absent: 'border-red-500 text-red-500 bg-red-50/80 dark:bg-red-500/10 rotate-[-12deg]',
  // Upright and grey: skipping is not a verdict about the person.
  skip: 'border-gray-400 text-gray-500 bg-gray-50/80 dark:bg-gray-700/40',
}

/* ------------------------------------------------------------- keyboard */

const onKeydown = (event) => {
  if (!current.value) return
  if (event.key === 'ArrowRight') { event.preventDefault(); decide('present') }
  else if (event.key === 'ArrowLeft') { event.preventDefault(); decide('absent') }
  else if (event.key === 'ArrowDown') { event.preventDefault(); decide('skip') }
  else if ((event.key === 'z' || event.key === 'Z') && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    undo()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  // A pending commit must not fire after the component is gone
  clearTimeout(exitTimer)
  clearTimeout(enterTimer)
  clearTimeout(arriveTimer)
})

// Face, name, nickname — nothing else. The card is a recognition test, and
// ministry chips only add something to read while you are trying to place a
// person.
const displayName = (member) => getFullName(member) || member.firstName || 'Member'
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <!-- Round status. The overall "46 of 102" lives in the page header and is
         visible from here, so this only carries what is specific to the round
         in progress: who still has to be dealt with. -->
    <div class="shrink-0 flex items-center justify-center gap-3 px-4 pt-2 pb-1">
      <span
        v-if="round > 1"
        class="px-2 py-0.5 rounded-full bg-primary/10 text-primary dark:text-primary-light text-[10px] font-bold uppercase tracking-widest"
      >
        Round {{ round }}
      </span>
      <span class="text-xs text-gray-500 dark:text-gray-400">
        <span class="font-bold text-gray-900 dark:text-white tabular-nums">{{ remaining }}</span> to go
        <span v-if="absent.size" class="text-gray-400 dark:text-gray-500">
          &middot; {{ absent.size }} marked absent
        </span>
      </span>
    </div>

    <!-- Deck -->
    <div class="flex-1 min-h-0 flex items-center justify-center px-4 py-2">
      <!-- A card to decide -->
      <div v-if="current" class="relative w-full max-w-sm aspect-[3/4] max-h-full select-none">
        <!-- Who is next. Not just a blank card edge: while the top card is
             being dragged away this is what you are about to decide on, so it
             rises and sharpens as the one in front commits. -->
        <div
          v-if="upNext"
          :key="`next-${idOf(upNext)}`"
          class="absolute inset-0 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
          :style="nextCardStyle"
          aria-hidden="true"
        >
          <div class="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
            <MemberAvatar
              :member="upNext"
              alt=""
              size="w-24 h-24"
              plain-class="border-4 border-gray-100 dark:border-gray-700"
            />
            <p class="text-base font-bold text-gray-500 dark:text-gray-400 leading-tight break-words">
              {{ displayName(upNext) }}
            </p>
            <p class="text-[10px] font-bold uppercase tracking-widest text-gray-300 dark:text-gray-600">
              Up next
            </p>
          </div>
        </div>

        <!-- Keyed by member: without it Vue reuses one element for everybody,
             so the incoming card inherits the outgoing card's transform and
             visibly slides in from wherever the last one was thrown. A fresh
             element has no previous position to animate from. -->
        <div
          :key="`card-${idOf(current)}`"
          class="absolute inset-0 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden touch-none cursor-grab active:cursor-grabbing"
          :style="cardStyle"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="resetDrag"
        >
          <!-- Verdict overlay, shown while dragging -->
          <div
            v-if="intent"
            class="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
            :style="{ opacity: intentOpacity }"
          >
            <div
              :class="[
                'px-6 py-3 rounded-2xl border-4 text-xl font-black uppercase tracking-widest',
                INTENT_CLASSES[intent],
              ]"
            >
              {{ INTENT_LABELS[intent] }}
            </div>
          </div>

          <div class="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
            <MemberAvatar
              :member="current"
              alt=""
              size="w-32 h-32"
              plain-class="border-4 border-gray-100 dark:border-gray-700 shadow-sm"
            />
            <div class="min-w-0">
              <p class="text-xl font-bold text-gray-900 dark:text-white leading-tight break-words">
                {{ displayName(current) }}
              </p>
              <p v-if="current.nickname" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                "{{ current.nickname }}"
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Deck exhausted -->
      <div v-else class="w-full max-w-sm text-center px-2">
        <div
          class="mx-auto w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center"
        >
          <ClipboardCheck class="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <p class="mt-4 text-lg font-bold text-gray-900 dark:text-white">
          {{ round === 1 ? 'Everyone checked' : `Round ${round} done` }}
        </p>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {{ present.size }} present, {{ absent.size }} absent<span v-if="undecided > 0">, {{ undecided }} not marked</span>.
        </p>

        <div class="mt-6 space-y-2">
          <button
            v-if="absent.size > 0"
            @click="nextRound"
            class="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-primary text-white text-sm font-semibold shadow-sm transition-transform active:scale-95"
          >
            <Users class="h-4 w-4" />
            Check the {{ absent.size }} absent again
          </button>
          <button
            v-if="undecided > 0"
            @click="reviewUndecided"
            class="w-full h-12 flex items-center justify-center gap-2 rounded-xl border border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-400 text-sm font-semibold transition-colors hover:bg-amber-50 dark:hover:bg-amber-500/10"
          >
            <RotateCcw class="h-4 w-4" />
            Go through the {{ undecided }} not marked
          </button>
          <button
            @click="emit('done')"
            class="w-full h-12 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Back to the list
          </button>
        </div>

        <p v-if="absent.size > 0" class="mt-4 text-xs text-gray-400 dark:text-gray-500">
          People arrive late &mdash; run another round any time before you save.
        </p>
      </div>
    </div>

    <!-- Controls. Not decoration: swiping alone would shut out anyone using a
         keyboard or a screen reader, and a thumb is less precise than a tap. -->
    <div v-if="current" class="shrink-0 px-4 pb-4 pt-1">
      <div class="flex items-center justify-center gap-3">
        <button
          @click="decide('absent')"
          class="h-16 w-16 rounded-full border-2 border-red-200 dark:border-red-500/30 text-red-500 flex items-center justify-center transition-transform active:scale-90 hover:bg-red-50 dark:hover:bg-red-500/10"
          aria-label="Mark absent"
        >
          <X class="h-7 w-7" />
        </button>

        <button
          @click="undo"
          :disabled="!history.length"
          class="h-12 w-12 rounded-full border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 flex items-center justify-center transition-transform active:scale-90 disabled:opacity-30"
          aria-label="Undo last"
        >
          <RotateCcw class="h-5 w-5" />
        </button>

        <button
          @click="decide('skip')"
          class="h-12 px-4 rounded-full border border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-500 dark:text-gray-400 transition-transform active:scale-90"
        >
          Skip
        </button>

        <button
          @click="decide('present')"
          class="h-16 w-16 rounded-full border-2 border-emerald-200 dark:border-emerald-500/30 text-emerald-500 flex items-center justify-center transition-transform active:scale-90 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
          aria-label="Mark present"
        >
          <Check class="h-7 w-7" />
        </button>
      </div>

      <p class="mt-3 flex items-center justify-center gap-4 text-[11px] text-gray-400 dark:text-gray-500">
        <span class="flex items-center gap-1"><ArrowLeft class="h-3 w-3" /> Absent</span>
        <span>Swipe down to skip</span>
        <span class="flex items-center gap-1">Present <ArrowRight class="h-3 w-3" /></span>
      </p>
    </div>
  </div>
</template>
