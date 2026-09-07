<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { usePermissions } from '../composables/usePermissions'
import { useRoute, useRouter } from 'vue-router'
import { useFocusTrap } from '../composables/useFocusTrap'
import { useAppSettings } from '../composables/useAppSettings'
import { Search, X } from '../icons'
import { NAV_ITEMS, navItemAllowed } from '../data/navigation'
import { useAppOrder, BAR_SLOTS } from '../composables/useAppOrder'
import { useDragReorder } from '../composables/useDragReorder'
import { useSwipeDismiss } from '../composables/useSwipeDismiss'
import AppTile from './nav/AppTile.vue'

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

const allowedApps = computed(() => NAV_ITEMS.filter(allowed))

// Which four ride on the bar is no longer a decision made here: it is whatever
// the person dragged to the front of the drawer, alphabetical until they do.
const { ordered, primary: primaryNav, setOrder, resetOrder } = useAppOrder(allowedApps)

// The drawer is the whole catalogue, one flat grid - including the four
// already on the bar. A home screen shows the apps in its dock too; leaving
// them out would make the drawer a list of leftovers rather than a map.
const appSearch = ref('')

const visibleApps = computed(() => {
  const q = appSearch.value.trim().toLowerCase()
  if (!q) return ordered.value
  return ordered.value.filter((i) => i.name.toLowerCase().includes(q))
})

// Dragging a filtered list says nothing about where those apps sit among the
// rest, so the grip only exists when the whole list is on screen.
const canReorder = computed(() => !appSearch.value.trim())

// The list the grid renders. It follows the saved order except mid-drag, when
// it is the thing being rearranged.
//
// dragItem rather than a separate grip: there is no room for one on a 56px
// tile, and the whole tile being the handle is what a phone home screen does.
// A press that does not move still lands as a click, so tapping to open an app
// is unaffected. It does mean a tile cannot be scrolled from - acceptable
// because seventeen apps at four across fit a full-height drawer without
// scrolling, and the gaps between tiles still scroll.
const dragList = ref([])
/**
 * A drop that touches the dock swaps the two apps rather than shifting the
 * list. Dragging the tenth app onto the second slot with an insert would push
 * the app that was second into third, third into fourth, and knock the fourth
 * off the bar entirely - three changes nobody asked for. A swap moves exactly
 * the two apps involved and leaves the rest of the bar where it was.
 *
 * Past the dock the ordinary lift-and-drop still applies: down there the order
 * is just an order, and shifting neighbours is what you would expect.
 */
const swapWithinDock = (list, from, to) => {
  if (from >= BAR_SLOTS && to >= BAR_SLOTS) {
    const next = [...list]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    return next
  }
  const next = [...list]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}

const { draggingIndex, dragItem } = useDragReorder(
  () => dragList.value,
  (next) => {
    dragList.value = next
  },
  { reorder: swapWithinDock, holdDelay: 350 }
)

// A drag that finishes over the tile it started on would otherwise land as a
// click and navigate away. One tick is enough: the click follows the pointerup
// immediately or not at all.
const justDragged = ref(false)
watch(draggingIndex, (now, before) => {
  if (before === null || now !== null) return
  justDragged.value = true
  setTimeout(() => (justDragged.value = false), 0)
})

const openApp = (path) => {
  if (justDragged.value) return
  navigate(path)
}

watch(
  visibleApps,
  (rows) => {
    if (draggingIndex.value === null) dragList.value = [...rows]
  },
  { immediate: true }
)

// Written once, on release - not on every swap under the finger.
watch(draggingIndex, (now, before) => {
  if (before !== null && now === null) setOrder(dragList.value)
})

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
// Measured too, not fixed: the tabs are elastic now.
const indicatorW = ref(44)
const indicatorShown = ref(false)
// The very first placement snaps: a pill sliding in from the left edge on
// every cold start would read as something still loading.
const indicatorAnimates = ref(false)

const activeTabPath = computed(() => primaryNav.value.find((item) => isActive(item.path))?.path)

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
  indicatorW.value = el.offsetWidth
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

// The whole sheet is swipeable now, not only its header. The gesture stands
// down whenever the grid under the finger is scrolled, so a flick partway down
// the list still scrolls it.
const { swipeTarget: sheetSwipe, swipeStyle: sheetStyle } = useSwipeDismiss({
  direction: 'down',
  onDismiss: closeMoreMenu,
  // Not while a tile is being dragged to a new place.
  enabled: () => draggingIndex.value === null,
})

// The dock and everything under it are one list as far as dragging is
// concerned - the indexes run straight through - but two blocks on screen, so
// the dock can sit on a single background instead of four separate ones.
const dockApps = computed(() => (canReorder.value ? dragList.value.slice(0, BAR_SLOTS) : []))
const restApps = computed(() =>
  canReorder.value ? dragList.value.slice(BAR_SLOTS) : dragList.value
)
</script>

<template>
  <!-- The app drawer behind the centre button. It takes almost the whole
       screen, leaving a strip of the page visible so it still reads as a sheet
       pulled up over the app rather than a new screen. It sits above the
       topbar: at this height it would otherwise run underneath it. It also
       covers the bar it was opened from, so the tab strip never competes with
       the grid it just opened. -->
  <Transition name="more-sheet">
    <div
      v-if="showMoreMenu"
      class="lg:hidden fixed inset-0 z-110 flex flex-col justify-end no-print"
    >
      <div class="absolute inset-0 bg-black/50 backdrop-blur-[2px]" @click="closeMoreMenu" />

      <div
        ref="moreMenuRef"
        role="dialog"
        aria-modal="true"
        aria-labelledby="more-menu-title"
        tabindex="-1"
        v-bind="sheetSwipe"
        :style="sheetStyle()"
        class="more-sheet-panel relative z-10 w-full h-full flex flex-col rounded-t-3xl bg-white dark:bg-gray-800 shadow-2xl border-t border-gray-200 dark:border-gray-700"
      >
        <div class="shrink-0 rounded-t-3xl pt-[env(safe-area-inset-top)]">
          <!-- Grab handle. It reads as something you can pull the sheet down
               by, so it does that rather than only looking the part: pressing
               it closes the drawer. The whole strip is the target, not the
               9mm bar, because that is what a thumb actually aims at. -->
          <button
            type="button"
            @click="closeMoreMenu"
            aria-label="Close apps"
            class="group flex w-full justify-center pt-2.5 pb-1"
          >
            <span
              class="h-1 w-9 rounded-full bg-gray-300 transition-colors group-active:bg-gray-400 dark:bg-gray-600 dark:group-active:bg-gray-500"
            />
          </button>
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

        <!-- Search first: seventeen apps is past the point where scanning a
             grid beats typing three letters. -->
        <div class="shrink-0 px-3 pb-2">
          <div class="relative">
            <Search
              class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            />
            <input
              v-model="appSearch"
              type="text"
              placeholder="Search apps"
              class="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-9 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary placeholder:text-gray-400 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
            <button
              v-if="appSearch"
              @click="appSearch = ''"
              aria-label="Clear search"
              class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X class="h-4 w-4" />
            </button>
          </div>

        </div>

        <!-- One flat grid, no headings. The order is the person's own, so a
             category would only argue with it. -->
        <!-- overscroll-contain: without it a flick down at the top of this list
             is handed to the browser, and Chrome on Android turns that into a
             pull-to-refresh - the sheet vanishes and the page reloads. -->
        <nav
          class="flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <p
            v-if="!dragList.length"
            class="px-1 py-8 text-center text-[11px] text-gray-400 dark:text-slate-500"
          >
            No app matches “{{ appSearch }}”.
          </p>
          <!-- The dock is one block on one background, not four tiles each
               wearing their own. Four separate grounds read as four selected
               things rather than one shelf, and the shelf is the idea: these
               are the apps on the bar. The background is decoration only -
               dragging happens on the tiles inside it, never on the panel. -->
          <template v-else>
            <div
              v-if="dockApps.length"
              class="mb-2 rounded-2xl bg-primary/[0.07] p-2 ring-1 ring-inset ring-primary/15 dark:bg-primary-light/[0.07] dark:ring-primary-light/15"
            >
              <div class="mb-1.5 flex items-center gap-2 px-1">
                <span class="text-[10px] font-black uppercase tracking-widest text-primary dark:text-primary-light">
                  On the bar
                </span>
                <span class="h-px flex-1 bg-primary/20 dark:bg-primary-light/20" />
                <span class="text-[10px] text-gray-400 dark:text-slate-500">drag to change</span>
              </div>

              <div class="grid grid-cols-4 gap-x-0.5">
                <div
                  v-for="(item, index) in dockApps"
                  :key="item.path"
                  v-bind="dragItem(index)"
                  :class="draggingIndex === index ? 'opacity-90' : ''"
                >
                  <AppTile :item="item" :active="isActive(item.path)" @click="openApp(item.path)" />
                </div>
              </div>
            </div>

            <div class="grid grid-cols-4 gap-x-0.5 gap-y-0.5">
              <div
                v-for="(item, i) in restApps"
                :key="item.path"
                v-bind="canReorder ? dragItem(i + BAR_SLOTS) : {}"
                :class="draggingIndex === i + BAR_SLOTS ? 'opacity-90' : ''"
              >
                <AppTile :item="item" :active="isActive(item.path)" @click="openApp(item.path)" />
              </div>
            </div>
          </template>
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
      class="nav-island pointer-events-auto relative mx-auto flex h-16 w-full items-center rounded-[1.75rem] border border-gray-200/70 bg-white/80 px-1.5 backdrop-blur-xl dark:border-white/10 dark:bg-gray-800/80"
    >
      <!-- The travelling pill. One element for the whole strip, moved by
           transform so the slide runs on the compositor. -->
      <span
        class="nav-indicator"
        :class="{
          'nav-indicator-on': indicatorShown,
          'nav-indicator-instant': !indicatorAnimates,
        }"
        :style="{
          transform: `translate3d(${indicatorX}px, -50%, 0)`,
          width: `${indicatorW}px`,
          marginLeft: `-${indicatorW / 2}px`,
        }"
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
          class="relative z-10 flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 transition-transform duration-150 active:scale-90"
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
          <span
            class="nav-label"
            :class="isActive(item.path) ? 'nav-label-active' : 'nav-label-idle'"
          >
            {{ item.short || item.name }}
          </span>
        </button>
      </div>

      <!-- Holds the middle of the strip open; the button itself is positioned
           over this gap so it can break the top edge of the bar. -->
      <div class="w-24 shrink-0" aria-hidden="true" />

      <div class="flex flex-1 justify-around">
        <button
          v-for="item in rightNav"
          :key="item.name"
          :ref="(el) => setTabRef(item.path, el)"
          @click="navigate(item.path)"
          :title="item.name"
          :aria-label="item.name"
          :aria-current="isActive(item.path) ? 'page' : undefined"
          class="relative z-10 flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 transition-transform duration-150 active:scale-90"
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
          <span
            class="nav-label"
            :class="isActive(item.path) ? 'nav-label-active' : 'nav-label-idle'"
          >
            {{ item.short || item.name }}
          </span>
        </button>
      </div>

      <!-- Every other page in the app lives behind this one. It is the mark
           itself - no plate, no padding, no ground - raised out of the bar so
           it is plainly not a tab: it opens a chooser rather than going
           anywhere. `logoUrl` already swaps to the church's dark mark when one
           is set, so the artwork carries the theme without a tile doing it.

           Taller than the bar on purpose: at 96px against a 64px strip it
           stands well clear of the top edge, which is what makes it read as
           sitting on the bar rather than in it. The spacer beside it matches
           its width, so the tabs are never underneath it - and that is what
           the size costs, since the four tabs share whatever is left. -->
      <button
        @click="toggleMoreMenu"
        class="more-button absolute -top-7 left-1/2 z-10 flex h-24 w-24 -translate-x-1/2 items-center justify-center transition-transform duration-150 active:scale-95"
        aria-label="Apps"
        aria-haspopup="dialog"
        :aria-expanded="showMoreMenu"
      >
        <img :src="logoUrl" alt="" class="h-24 w-24 object-contain" />
      </button>

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

/* The tab's name. Narrow tabs, so it is small and never wraps - an ellipsis is
   better than a second line pushing the icon out of the bar. */
.nav-label {
  max-width: 100%;
  overflow: hidden;
  font-size: 0.5625rem;
  font-weight: 500;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.3s ease;
}

.nav-label-idle {
  color: rgb(156 163 175); /* gray-400 */
}

:global(.dark) .nav-label-idle {
  color: rgb(107 114 128); /* gray-500 */
}

.nav-label-active {
  color: var(--color-primary);
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

/* No shadow: there is no plate to cast one now, and a drop shadow on a
   transparent PNG outlines the artwork rather than lifting it. */

@media (prefers-reduced-motion: reduce) {
  .nav-indicator,
  .nav-glyph,
  .more-button {
    transition: none;
  }
}
</style>
