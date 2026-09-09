<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  BookOpen,
  Calendar,
  Church,
  Clock,
  HandHeart,
  HeartHandshake,
  MapPin,
  PartyPopper,
  Sparkles,
  Users,
  X,
  Gift,
} from '../../icons'
import { useFocusTrap } from '../../composables/useFocusTrap'
import { dayLabel, daysUntil, monthOf, dayOf, whenLine } from '../../utils/publicDates'

// What's coming up, as a thing in the corner rather than a row in the page.
//
// The gatherings used to sit inline under the hero, which is the one place a
// visitor is trying to read a sentence. Here they wait in the corner with a
// count on them, nudge occasionally with the next one, and open on a tap.
const props = defineProps({
  gatherings: { type: Array, default: () => [] },
  // The member record the signed-in account is linked to, when there is one.
  // Only ever used to recognise this reader's own birthday in the list.
  myMemberId: { type: String, default: '' },
})

const TYPE_ICONS = {
  worship: Church,
  prayer: HandHeart,
  fellowship: Users,
  outreach: HeartHandshake,
  celebration: PartyPopper,
  special: Sparkles,
  training: BookOpen,
  birthday: Gift,
}
const iconFor = (type) => TYPE_ICONS[type] || Calendar

// A birthday has no start time, so "Gathering" would be wrong and the clock
// line would be empty. It gets its own word and its own row instead.
const labelFor = (type) =>
  type === 'birthday' ? 'Birthday' : type ? type[0].toUpperCase() + type.slice(1) : 'Gathering'

// A birthday arrives from the server titled "Kaarawan ni Dyze", because the
// server is answering for a page anyone may be reading. When the reader is
// Dyze, that is the app talking about them in the third person to their face.
// The id carries the member it was built from, so the one entry that is
// theirs is addressed to them instead.
const titleOf = (gathering) =>
  gathering.type === 'birthday' &&
  props.myMemberId &&
  gathering.id === `birthday-${props.myMemberId}`
    ? 'Birthday Mo'
    : gathering.title

const open = ref(false)
const dialog = ref(null)
const trigger = ref(null)

/* ------------------------------------------------------------ what it shows

   Focused means one thing at a time. The next gathering is the answer to the
   question somebody actually has — when could I come? — so it gets the whole
   top of the sheet. Everything after it is a quiet list you can glance down,
   not six cards competing with the one that matters. */

const next = computed(() => props.gatherings[0] || null)
const later = computed(() => props.gatherings.slice(1))

/* -------------------------------------------------------- opening it nicely

   The sheet is revealed by a circle growing out of the icon that was tapped,
   rather than arriving from an edge. The app already opens its theme switch
   this way, so it is the gesture this codebase already speaks — and it ties
   the sheet to the thing that summoned it instead of leaving the reader to
   work out where it came from. */

const origin = ref({ x: 0, y: 0 })

const toggle = () => {
  if (open.value) {
    open.value = false
    return
  }
  const box = trigger.value?.getBoundingClientRect()
  if (box) origin.value = { x: box.left + box.width / 2, y: box.top + box.height / 2 }
  open.value = true
}

// Escape, initial focus, focus handed back to the icon on close, and the page
// held still underneath — the same treatment every other dialog in the app
// gets. The scroll lock used to be written out here by hand; it lives in
// useFocusTrap now, so every dialog gets it rather than the ones that
// remembered to ask.
useFocusTrap(dialog, open, () => {
  open.value = false
})

/* ------------------------------------------------------------------ peeks */

// Every few seconds one gathering leans out of the dock, says what it is, and
// tucks itself away again. Only while the sheet is shut, only when there is
// something to say, and never for somebody who has asked for less motion.
const PEEK_AFTER = 2600
const PEEK_FOR = 5200
const PEEK_GAP = 9000

const peekIndex = ref(0)
const peeking = ref(false)
let timer = null

const quiet = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const stopPeeking = () => {
  if (timer) clearTimeout(timer)
  timer = null
  peeking.value = false
}

const schedulePeek = (delay) => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    if (open.value || !unseen.value.length) return
    peeking.value = true
    timer = setTimeout(() => {
      peeking.value = false
      peekIndex.value = (peekIndex.value + 1) % props.gatherings.length
      schedulePeek(PEEK_GAP)
    }, PEEK_FOR)
  }, delay)
}

const peeked = computed(() => props.gatherings[peekIndex.value] || null)

onMounted(() => {
  if (quiet() || !unseen.value.length) return
  schedulePeek(PEEK_AFTER)
})

onUnmounted(stopPeeking)

// Opening answers the question the peek was asking, so it stops asking.
watch(open, (value) => {
  if (!value) return
  stopPeeking()
  markSeen()
})

/* ------------------------------------------------------------------ badge

   It counts what this visitor has not seen yet, and goes quiet once they
   have looked. A badge that comes back on every visit stops meaning anything
   — it has to be able to say "nothing new" or it is only decoration.

   What counts as one thing is the gathering and the day it falls on: a
   weekly service that has rolled on to next Sunday is genuinely something
   else to know about, where the same Sunday seen twice is not. */

const SEEN_KEY = 'uec:upcoming-seen'

const tokenOf = (gathering) => `${gathering.id}@${gathering.date}`

const readSeen = () => {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    // Private windows and blocked storage both land here. Losing the record
    // means the badge shows again, which is the harmless direction to fail.
    return new Set()
  }
}

const seen = ref(readSeen())

const unseen = computed(() => props.gatherings.filter((g) => !seen.value.has(tokenOf(g))))

const badge = computed(() => unseen.value.length)

// Opening it is what counts as having looked. Only what is on the page now is
// remembered, so the record cannot grow forever.
const markSeen = () => {
  const tokens = props.gatherings.map(tokenOf)
  seen.value = new Set(tokens)
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(tokens))
  } catch {
    // Nothing to do — the badge simply keeps showing.
  }
}
</script>

<template>
  <div class="pointer-events-none fixed inset-0 z-50">
    <!-- The whole sheet — dimmed page and all — is revealed by one circle
         opening out of the icon, which is why they share a wrapper. -->
    <Transition name="reveal">
      <div
        v-if="open"
        class="reveal-layer pointer-events-auto absolute inset-0"
        :style="{ '--ox': origin.x + 'px', '--oy': origin.y + 'px' }"
      >
        <div class="absolute inset-0 bg-[#04202a]/80 backdrop-blur-md" @click="open = false"></div>

        <div
          ref="dialog"
          tabindex="-1"
          role="dialog"
          aria-modal="true"
          aria-label="Upcoming gatherings"
          class="absolute inset-x-4 top-1/2 mx-auto max-w-md -translate-y-1/2 overflow-hidden rounded-3xl bg-[#062832] shadow-2xl outline-none ring-1 ring-white/10 sm:inset-x-0"
        >
          <header class="flex items-center justify-between px-6 pt-6">
            <p class="text-[11px] font-black uppercase tracking-[0.3em] text-primary-light">
              Upcoming
            </p>
            <button
              @click="open = false"
              class="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X class="h-5 w-5" />
            </button>
          </header>

          <!-- The one that matters. Big date, big name, and the two facts a
               stranger needs before they can decide to come. -->
          <div v-if="next" class="px-6 pb-6 pt-5">
            <div class="flex items-start gap-4">
              <!-- A birthday leads with the face when there is one: it is a
                   person, not a date in the diary. The day moves up into the
                   line above, which is where it reads better anyway. -->
              <img
                v-if="next.avatar"
                :src="next.avatar"
                alt=""
                loading="lazy"
                decoding="async"
                class="h-[4.5rem] w-[4.5rem] shrink-0 rounded-full object-cover ring-2 ring-primary-light"
              />
              <div
                v-else
                class="flex h-[4.5rem] w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-2xl bg-primary-light text-[#062832]"
              >
                <span class="text-[10px] font-black uppercase tracking-widest">
                  {{ monthOf(next.date) }}
                </span>
                <span class="font-serif text-3xl font-bold leading-none">
                  {{ dayOf(next.date) }}
                </span>
              </div>
              <div class="min-w-0 flex-1 pt-1">
                <p class="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                  {{ dayLabel(next.date)
                  }}<template v-if="next.avatar">
                    · {{ monthOf(next.date) }} {{ dayOf(next.date) }}</template
                  >
                </p>
                <h2 class="mt-1 font-serif text-2xl font-semibold leading-tight text-white">
                  {{ titleOf(next) }}
                </h2>
              </div>
            </div>

            <div class="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/70">
              <span v-if="whenLine(next)" class="inline-flex items-center gap-2">
                <Clock class="h-4 w-4 shrink-0 text-primary-light" />
                {{ whenLine(next) }}
              </span>
              <span class="inline-flex items-center gap-2">
                <component :is="iconFor(next.type)" class="h-4 w-4 shrink-0 text-primary-light" />
                {{ labelFor(next.type) }}
              </span>
            </div>
          </div>

          <!-- Nothing coming up is an answer, not a failure, so it gets a
               sentence rather than an empty sheet. The dock used to vanish
               entirely in this state, which reads to a visitor as a page that
               forgot to load — and it hid the one place they would look to
               find out there is nothing on this week. -->
          <div v-else class="px-6 pb-7 pt-5">
            <div class="flex items-start gap-4">
              <div
                class="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-primary-light"
              >
                <Calendar class="h-8 w-8" />
              </div>
              <div class="min-w-0 flex-1 pt-2">
                <h2 class="font-serif text-xl font-semibold leading-tight text-white">
                  Wala pang nakatakda
                </h2>
                <p class="mt-1.5 text-sm leading-relaxed text-white/50">
                  Makikita mo rito ang susunod naming pagtitipon.
                </p>
              </div>
            </div>
          </div>

          <!-- Everything after it, quiet. One line each, so the eye runs down
               the dates rather than reading six cards. -->
          <div v-if="later.length" class="border-t border-white/[0.08] bg-white/[0.02]">
            <p
              class="px-6 pb-2 pt-4 text-[10px] font-black uppercase tracking-[0.25em] text-white/30"
            >
              Then
            </p>
            <ul class="max-h-[34svh] overflow-y-auto pb-2">
              <li
                v-for="(gathering, index) in later"
                :key="gathering.id"
                class="row flex items-center gap-4 px-6 py-2.5"
                :style="{ '--i': index }"
              >
                <span
                  class="w-12 shrink-0 font-serif text-sm tabular-nums text-white/45"
                >
                  {{ monthOf(gathering.date) }} {{ dayOf(gathering.date) }}
                </span>
                <img
                  v-if="gathering.avatar"
                  :src="gathering.avatar"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  class="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-white/20"
                />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-semibold text-white/90">
                    {{ titleOf(gathering) }}
                  </span>
                  <span class="block truncate text-[11px] text-white/40">
                    {{ whenLine(gathering) }}
                  </span>
                </span>
              </li>
            </ul>
          </div>

          <!-- A visitor who has read this far is deciding whether to turn up. -->
          <div class="border-t border-white/[0.08] px-6 py-4">
            <p class="flex items-center gap-2 text-[11px] leading-relaxed text-white/45">
              <MapPin class="h-3.5 w-3.5 shrink-0 text-primary-light" />
              Lahat ay malugod na inaanyayahan.
            </p>
          </div>
        </div>
      </div>
    </Transition>

    <!-- The dock. Under the masthead rather than over it, and tight to the
         right edge — a corner is where this belongs, but the very corner is
         where the header already is. -->
    <div
      class="pointer-events-none absolute right-0 top-20 flex items-start justify-end gap-2 sm:right-1 sm:top-24"
    >
      <Transition name="peek">
        <button
          v-if="peeking && peeked && !open"
          @click="toggle"
          class="pointer-events-auto mt-1 max-w-[min(16rem,calc(100vw-6.5rem))] rounded-xl border border-white/10 bg-[#062832] px-3.5 py-2.5 text-left shadow-xl"
        >
          <p class="text-[9px] font-bold uppercase tracking-[0.2em] text-primary-light">
            {{ dayLabel(peeked.date) || 'Soon' }}
          </p>
          <p class="truncate font-serif text-sm font-semibold leading-tight text-white">
            {{ titleOf(peeked) }}
          </p>
        </button>
      </Transition>

      <!-- No frame behind it: the icon is the button, and the word sits
           loose underneath. The pill made it obviously pressable but it also
           made it a chip stuck to the page — this is meant to be a little
           object hanging in the corner. The word carries the meaning the
           frame used to, and the tip carries the invitation. -->
      <button
        ref="trigger"
        @click="toggle"
        class="dock-btn pointer-events-auto relative block shrink-0"
        :class="{ 'is-open': open }"
        :aria-label="open ? 'Hide upcoming gatherings' : badge ? `Events (${badge} new)` : 'Events'"
        :aria-expanded="open"
      >
        <svg
          viewBox="0 0 48 48"
          class="dock-art mx-auto block h-14 w-14 sm:h-16 sm:w-16"
          role="img"
          aria-hidden="true"
        >
          <!-- Flat: no turned faces, no gradients, no shear, no shadow.
               Tilted a few degrees in the plane of the page, the way a calendar
               hanging on one nail sits — style, not depth. One day ringed in red.
               The two rings are pale so they hold up over a photograph. -->
          <g transform="rotate(-8 24 24)">
          <rect x="15.5" y="5.5" width="3.2" height="8" rx="1.6" fill="#cfdadd"/>
          <rect x="29.3" y="5.5" width="3.2" height="8" rx="1.6" fill="#cfdadd"/>
          <rect x="8" y="10" width="32" height="30" rx="2.5" fill="#ffffff"/>
          <path d="M8 12.5A2.5 2.5 0 0 1 10.5 10h27A2.5 2.5 0 0 1 40 12.5V19H8z" fill="#0288ac"/>
          <rect x="12.5" y="23" width="5" height="5" rx="1" fill="#93a8b0"/>
          <rect x="21.5" y="23" width="5" height="5" rx="1" fill="#93a8b0"/>
          <rect x="30.5" y="23" width="5" height="5" rx="1" fill="#93a8b0"/>
          <rect x="12.5" y="31" width="5" height="5" rx="1" fill="#93a8b0"/>
          <rect x="21.5" y="31" width="5" height="5" rx="1" fill="#e2483d"/>
          <rect x="30.5" y="31" width="5" height="5" rx="1" fill="#93a8b0"/>
          </g>
        </svg>

        <!-- Nothing behind the word either, so it is shadowed instead: it has
             to stay readable over whichever photograph the hero is showing. -->
        <span
          class="dock-label mt-0.5 block text-center text-[10px] font-bold uppercase leading-none tracking-[0.14em] text-white"
        >
          Events
        </span>

        <span
          v-if="badge && !open"
          class="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e2483d] px-1 text-[9px] font-black leading-none text-white"
        >
          {{ badge > 9 ? '9+' : badge }}
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* The sheet is uncovered by a circle growing out of the icon that was tapped.
   The origin is written in as CSS variables at click time, so the reveal
   always starts from wherever the dock actually is. */
.reveal-enter-active {
  animation: reveal-in 480ms cubic-bezier(0.4, 0, 0.2, 1);
}

.reveal-leave-active {
  animation: reveal-in 320ms cubic-bezier(0.4, 0, 1, 1) reverse;
}

@keyframes reveal-in {
  from {
    clip-path: circle(0px at var(--ox) var(--oy));
  }
  to {
    clip-path: circle(150% at var(--ox) var(--oy));
  }
}

/* The rows arrive just behind the circle, one after another, so the list
   settles rather than snapping into place all at once. */
.reveal-enter-active .row {
  animation: row-in 380ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: calc(180ms + var(--i) * 45ms);
}

@keyframes row-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

/* A peek slides out from behind the icon. */
.peek-enter-active {
  transition: opacity 280ms ease, transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}
.peek-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.peek-enter-from,
.peek-leave-to {
  opacity: 0;
  transform: translateX(0.75rem) scale(0.96);
}

/* Out of the way while the sheet is open.
   The circle that reveals the sheet grows out of this icon, so leaving it
   sitting on top of what it just opened reads as two things rather than one.
   Hidden by opacity rather than v-if on purpose: the element has to stay in
   the document for the focus trap to hand focus back to it on close. */
.dock-btn {
  transition: opacity 200ms ease, transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dock-btn.is-open {
  pointer-events: none !important;
  opacity: 0;
  transform: scale(0.5);
}

.dock-btn:active {
  transform: scale(0.92);
}

/* One movement only. The drift and the pulsing day were dropped long ago, and
   the ring went with the pill it was drawn around — an expanding rectangle
   needs an edge to expand from. What is left is the tip, which is the one that
   reads as an invitation rather than an alarm.

   Every nine seconds it tips over and rights itself, the way a page hanging on
   a nail would if somebody walked past. Pivoted at the rings, because that is
   what it is hanging from. Mostly stillness: an icon that never stops moving
   is a page that never settles. */
.dock-art {
  transform-origin: 50% 12%;
  animation: dock-nudge 9s ease-in-out infinite;
}

.dock-btn:hover .dock-art,
.dock-btn.is-open .dock-art {
  animation-play-state: paused;
}

@keyframes dock-nudge {
  0%,
  84%,
  100% {
    transform: rotate(0deg);
  }
  87% {
    transform: rotate(-9deg);
  }
  90% {
    transform: rotate(7deg);
  }
  93% {
    transform: rotate(-4deg);
  }
  96% {
    transform: rotate(1.5deg);
  }
}

.dock-label {
  text-shadow: 0 1px 4px rgba(2, 20, 28, 0.9);
}

@media (prefers-reduced-motion: reduce) {
  .dock-art {
    animation: none;
  }
  .reveal-enter-active,
  .reveal-leave-active,
  .reveal-enter-active .row {
    animation-duration: 1ms;
  }
  .peek-enter-active,
  .peek-leave-active {
    transition-duration: 1ms;
  }
}
</style>
