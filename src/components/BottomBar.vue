<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { usePermissions } from '../composables/usePermissions'
import { useRoute, useRouter } from 'vue-router'
import { useFocusTrap } from '../composables/useFocusTrap'
import { useAppSettings } from '../composables/useAppSettings'
import { X } from '../icons'
import {
  NAV_ITEMS,
  PRIMARY_PATHS,
  allowedGroups,
  navItemAllowed,
} from '../data/navigation'

const route = useRoute()
const router = useRouter()
const { can, isAdmin } = usePermissions()
const { logoUrl } = useAppSettings()
const showMoreMenu = ref(false)

// The sidebar, the home catalogue and this bar all read from data/navigation,
// so a page added in one place cannot go missing from another - which is
// exactly how Presentation ended up reachable from a desktop and nowhere on a
// phone.
const allowed = (item) => navItemAllowed(item, can, isAdmin.value)

// Four tabs, split around the centre button. Attendance is one of them rather
// than a drawer item because it is recorded on a phone, week in week out, right
// after the gathering it belongs to - two taps behind a drawer is one too many
// for the thing people open this app to do.
const primaryNav = computed(() =>
  PRIMARY_PATHS.map((path) => NAV_ITEMS.find((item) => item.path === path))
    .filter(Boolean)
    .filter(allowed)
)

// The drawer is the whole catalogue, in the home page's grouping - including
// the four already on the bar. A home screen shows the apps that are in the
// dock too; leaving them out would make the drawer a list of leftovers rather
// than a map of the app.
const appGroups = computed(() => allowedGroups(can, isAdmin.value))

// The centre button sits between the halves rather than at one end, so the
// split has to survive a shorter nav: with three tabs the spare one goes left,
// with one it is the only thing on that side.
const splitAt = computed(() => Math.ceil(primaryNav.value.length / 2))
const leftNav = computed(() => primaryNav.value.slice(0, splitAt.value))
const rightNav = computed(() => primaryNav.value.slice(splitAt.value))

const isActive = (path) => {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}

// With the labels gone, the selected tab is marked by one pill that slides
// between the icons rather than a background per tab switching on and off: the
// travel is what tells you which way you just moved. Its position has to be
// measured rather than calculated, because the two tab groups sit either side
// of the centre button and so are not a uniform grid.
const islandRef = ref(null)
const tabEls = new Map()
const setTabRef = (path, el) => {
  if (el) {
    tabEls.set(path, el)
  } else {
    tabEls.delete(path)
  }
}

const indicatorX = ref(0)
const indicatorShown = ref(false)
// The very first placement snaps: a pill sliding in from the left edge on
// every cold start would read as something still loading.
const indicatorAnimates = ref(false)

const activeTabPath = computed(() => primaryNav.value.find((item) => isActive(item.path))?.path)

// The one thing the drawer button cannot say by itself: that the page you are
// on is in the drawer and not on the bar. A page outside the catalogue
// entirely - the home grid itself - marks nothing, because nothing in the
// drawer would light up if you opened it.
const isDrawerActive = computed(
  () => NAV_ITEMS.some((item) => isActive(item.path)) && !activeTabPath.value
)

const placeIndicator = () => {
  const el = activeTabPath.value ? tabEls.get(activeTabPath.value) : null
  if (!el || !islandRef.value) {
    // Nothing on the strip is current - the page came out of the drawer - so
    // the pill fades out where it stands rather than sliding off to nowhere.
    indicatorShown.value = false
    return
  }
  // offsetLeft is measured against the island, which is the nearest
  // positioned ancestor.
  indicatorX.value = el.offsetLeft + el.offsetWidth / 2
  indicatorShown.value = true
}

// The strip is display:none until the viewport is narrow enough, and a hidden
// element measures as zero, so the width it reports when it appears is the
// first honest one.
let resizeObserver = null

onMounted(() => {
  placeIndicator()
  requestAnimationFrame(() => {
    indicatorAnimates.value = true
  })
  if (typeof ResizeObserver !== 'undefined' && islandRef.value) {
    resizeObserver = new ResizeObserver(placeIndicator)
    resizeObserver.observe(islandRef.value)
  }
})

onBeforeUnmount(() => resizeObserver?.disconnect())

// primaryNav is watched alongside the route because capabilities arrive after
// the first render: a tab appearing shifts every tab to its right.
watch([activeTabPath, primaryNav], () => nextTick(placeIndicator))

const navigate = (path) => {
  showMoreMenu.value = false
  router.push(path)
}

const toggleMoreMenu = () => {
  showMoreMenu.value = !showMoreMenu.value
}

const closeMoreMenu = () => {
  showMoreMenu.value = false
}

const moreMenuRef = ref(null)
useFocusTrap(moreMenuRef, showMoreMenu, closeMoreMenu)
</script>

<template>
  <!-- The app drawer behind the centre button. It reaches the bottom edge of
       the screen and covers the bar it was opened from: perched on top of that
       bar it left the tab strip competing for the thumb with the grid it had
       just opened. -->
  <Transition name="more-sheet">
    <div
      v-if="showMoreMenu"
      class="lg:hidden fixed inset-0 z-55 flex flex-col justify-end no-print"
    >
      <div class="absolute inset-0 bg-black/50 backdrop-blur-[2px]" @click="closeMoreMenu" />

      <div
        ref="moreMenuRef"
        role="dialog"
        aria-modal="true"
        aria-labelledby="more-menu-title"
        tabindex="-1"
        class="more-sheet-panel relative z-10 w-full max-h-[85dvh] flex flex-col rounded-t-3xl bg-white dark:bg-gray-800 shadow-2xl border-t border-gray-200 dark:border-gray-700"
      >
        <div class="shrink-0 rounded-t-3xl">
          <!-- Grab handle: reads as a sheet sitting on the screen edge rather
               than a popup hanging off the bar. -->
          <div class="flex justify-center pt-2.5 pb-1">
            <div class="h-1 w-9 rounded-full bg-gray-300 dark:bg-gray-600" />
          </div>
          <div class="flex items-center justify-between px-4 pb-3 border-b border-gray-100 dark:border-gray-700">
            <h3 id="more-menu-title" class="text-base font-semibold text-gray-900 dark:text-white">
              Apps
            </h3>
            <button
              @click="closeMoreMenu"
              class="-mr-2 p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close menu"
            >
              <X class="h-5 w-5" />
            </button>
          </div>
        </div>

        <!-- The same tiles, grouping and density as the home catalogue, so the
             drawer and /home are one idea reached two ways rather than two
             different maps of the app. Four across puts most of the church on
             screen without a scroll, and the icon does the work a row of text
             would have needed a whole line for. -->
        <nav class="flex-1 overflow-y-auto px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <section v-for="group in appGroups" :key="group.key" class="pt-3">
            <h4
              v-if="group.label"
              class="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500"
            >
              {{ group.label }}
            </h4>

            <div class="grid grid-cols-4 gap-x-1 gap-y-2 sm:grid-cols-6">
              <button
                v-for="item in group.items"
                :key="item.path"
                @click="navigate(item.path)"
                :aria-current="isActive(item.path) ? 'page' : undefined"
                class="flex flex-col items-center gap-1 rounded-xl px-0.5 py-1.5 transition-colors active:bg-gray-100 dark:active:bg-gray-700/50"
              >
                <!-- A tinted ground with a coloured glyph, not white on solid:
                     these strokes are thin, and thin white on a saturated fill
                     is where they stop being readable at this size. The page
                     you are on deepens the tint and takes a ring rather than
                     inverting, so it stays in the same family as the rest. -->
                <span
                  :class="[
                    'grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl transition-colors',
                    isActive(item.path) ? 'app-tile-active' : 'app-tile',
                  ]"
                >
                  <img
                    v-if="item.image"
                    :src="item.image"
                    alt=""
                    class="h-8 w-8 object-contain"
                  />
                  <component v-else :is="item.icon" class="h-6 w-6" />
                </span>
                <span
                  :class="[
                    'line-clamp-2 w-full text-center text-[11px] leading-tight',
                    isActive(item.path)
                      ? 'font-semibold text-primary dark:text-primary-light'
                      : 'font-medium text-gray-700 dark:text-gray-300',
                  ]"
                >
                  {{ item.name }}
                </span>
              </button>
            </div>
          </section>
        </nav>
      </div>
    </div>
  </Transition>

  <!-- A floating island rather than a full-width strip: the page scrolls
       visibly past its frosted edges, which is what tells you there is more
       page down there. The outer band takes no pointer events, so the gap
       either side of the island still belongs to the content behind it. -->
  <nav
    class="lg:hidden fixed inset-x-0 bottom-0 z-50 no-print pointer-events-none px-3 pb-[calc(0.375rem+env(safe-area-inset-bottom))]"
  >
    <div
      ref="islandRef"
      class="nav-island pointer-events-auto relative mx-auto flex h-16 max-w-sm items-center rounded-[1.75rem] border border-gray-200/70 bg-white/80 px-1.5 backdrop-blur-xl dark:border-white/10 dark:bg-gray-800/80"
    >
      <!-- The travelling pill. One element for the whole strip, moved by
           transform so the slide runs on the compositor. -->
      <span
        class="nav-indicator"
        :class="{
          'nav-indicator-on': indicatorShown,
          'nav-indicator-instant': !indicatorAnimates,
        }"
        :style="{ transform: `translate3d(${indicatorX}px, -50%, 0)` }"
        aria-hidden="true"
      />

      <div class="flex flex-1 justify-around">
        <button
          v-for="item in leftNav"
          :key="item.name"
          :ref="(el) => setTabRef(item.path, el)"
          @click="navigate(item.path)"
          :title="item.name"
          :aria-label="item.name"
          :aria-current="isActive(item.path) ? 'page' : undefined"
          class="relative z-10 flex h-full w-14 items-center justify-center transition-transform duration-150 active:scale-90"
        >
          <img
            v-if="item.image"
            :src="item.image"
            alt=""
            class="nav-art"
            :class="isActive(item.path) ? 'nav-art-active' : 'nav-art-idle'"
          />
          <component
            v-else
            :is="item.icon"
            class="nav-glyph"
            :class="isActive(item.path) ? 'nav-glyph-active' : 'nav-glyph-idle'"
          />
        </button>
      </div>

      <!-- Holds the middle of the strip open; the button itself is positioned
           over this gap so it can break the top edge of the bar. -->
      <div class="w-16 shrink-0" aria-hidden="true" />

      <div class="flex flex-1 justify-around">
        <button
          v-for="item in rightNav"
          :key="item.name"
          :ref="(el) => setTabRef(item.path, el)"
          @click="navigate(item.path)"
          :title="item.name"
          :aria-label="item.name"
          :aria-current="isActive(item.path) ? 'page' : undefined"
          class="relative z-10 flex h-full w-14 items-center justify-center transition-transform duration-150 active:scale-90"
        >
          <img
            v-if="item.image"
            :src="item.image"
            alt=""
            class="nav-art"
            :class="isActive(item.path) ? 'nav-art-active' : 'nav-art-idle'"
          />
          <component
            v-else
            :is="item.icon"
            class="nav-glyph"
            :class="isActive(item.path) ? 'nav-glyph-active' : 'nav-glyph-idle'"
          />
        </button>
      </div>

      <!-- Every other page in the app lives behind this one. Raised out of the
           bar and wearing the church's mark, it is the only thing on the strip
           that does not look like a tab, which is the point: it opens a
           chooser rather than going anywhere itself.

           The tile stays light in both themes because the logo is a full
           colour mark that carries its own red and blue - on the theme colour
           the red of the cross would sink into the background. The red glow
           below is what keeps it looking lit from within rather than a card
           dropped onto the bar. -->
      <button
        @click="toggleMoreMenu"
        class="more-button absolute -top-1 left-1/2 z-10 flex h-[3.25rem] w-[3.25rem] -translate-x-1/2 items-center justify-center rounded-[1.15rem] bg-white transition-transform duration-150 active:scale-95"
        aria-label="Apps"
        aria-haspopup="dialog"
        :aria-expanded="showMoreMenu"
      >
        <img :src="logoUrl" alt="" class="h-11 w-11 object-contain" />
      </button>

      <!-- The one thing the raised button cannot say by itself: that the page
           you are on right now came out of the drawer behind it. -->
      <span
        v-if="isDrawerActive"
        class="more-dot absolute bottom-1.5 left-1/2 z-10 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
        aria-hidden="true"
      />
    </div>
  </nav>
</template>

<style scoped>
/* The backdrop fades while the panel inside it slides, so the two read as one
   sheet rising rather than a box appearing. */
.more-sheet-enter-active,
.more-sheet-leave-active {
  transition: opacity 0.2s ease;
}

.more-sheet-enter-from,
.more-sheet-leave-to {
  opacity: 0;
}

.more-sheet-enter-active .more-sheet-panel,
.more-sheet-leave-active .more-sheet-panel {
  transition: transform 0.25s ease;
}

.more-sheet-enter-from .more-sheet-panel,
.more-sheet-leave-to .more-sheet-panel {
  transform: translateY(100%);
}

.nav-island {
  box-shadow: 0 12px 32px -12px rgba(15, 23, 42, 0.45);
}

/* With the labels gone, the selected tab carries the whole answer to "where am
   I", so it gets a tinted squircle, a larger glyph and a soft glow in the
   theme colour - legible at a glance without a word under it.

   The squircle is a single element that slides, not one per tab: the eye
   follows the movement to the new tab, which is the part that tells you the
   nav went somewhere. Overshooting slightly on the way (the easing below) is
   what keeps it from feeling like a box being dragged. */
.nav-indicator {
  position: absolute;
  left: 0;
  top: 50%;
  height: 2.75rem;
  width: 2.75rem;
  margin-left: -1.375rem;
  border-radius: 1rem;
  background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
  box-shadow: 0 8px 18px -10px var(--color-primary);
  opacity: 0;
  pointer-events: none;
  transition:
    transform 0.42s cubic-bezier(0.22, 1.1, 0.36, 1),
    opacity 0.25s ease;
}

.nav-indicator-on {
  opacity: 1;
}

/* First paint, and any re-measure while the strip was hidden: land on the
   active tab rather than sliding to it from wherever the last layout left it. */
.nav-indicator-instant {
  transition: none;
}

/* Artwork on the bar. It cannot take a colour the way a glyph can, so the
   selected tab is told apart by the sliding pill behind it and by the same
   size step the glyphs use; idle is simply dimmed. */
.nav-art {
  height: 1.5rem;
  width: 1.5rem;
  object-fit: contain;
  transition:
    opacity 0.3s ease,
    height 0.3s ease,
    width 0.3s ease;
}

.nav-art-idle {
  opacity: 0.55;
}

.nav-art-active {
  height: 1.625rem;
  width: 1.625rem;
  opacity: 1;
}

.nav-glyph {
  height: 1.5rem;
  width: 1.5rem;
  transition:
    color 0.3s ease,
    height 0.3s ease,
    width 0.3s ease;
}

.nav-glyph-idle {
  color: rgb(156 163 175); /* gray-400 */
}

:global(.dark) .nav-glyph-idle {
  color: rgb(107 114 128); /* gray-500 */
}

.nav-glyph-active {
  height: 1.625rem;
  width: 1.625rem;
  color: var(--color-primary);
}

.more-dot {
  background-color: var(--color-primary);
}

/* The drawer tiles, in the same colour language as the travelling pill on the
   bar: one tint, deepened and ringed for the page you are on. */
.app-tile {
  background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
  color: var(--color-primary);
}

.app-tile-active {
  background-color: color-mix(in srgb, var(--color-primary) 22%, transparent);
  color: var(--color-primary);
  box-shadow:
    inset 0 0 0 2px color-mix(in srgb, var(--color-primary) 35%, transparent),
    0 8px 18px -10px var(--color-primary);
}

/* The raised button throws its own colour rather than a black drop shadow, so
   it reads as lit from within instead of a card dropped onto the bar. */
.more-button {
  box-shadow:
    0 10px 22px -8px color-mix(in srgb, var(--color-primary) 75%, transparent),
    0 2px 6px -2px rgba(15, 23, 42, 0.3);
}

@media (prefers-reduced-motion: reduce) {
  .nav-indicator,
  .nav-glyph,
  .more-button {
    transition: none;
  }
}
</style>
