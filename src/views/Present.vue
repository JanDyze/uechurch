<script setup>
/**
 * The tech page: one service, in the order it will be run, ready to project.
 *
 * Separate from the song editor on purpose. Editing a song is about one song;
 * running a service is about a sequence of unrelated things — songs, a reading,
 * an announcement, a video — and the person doing it is in a booth at the back
 * with a projector on the second output. That is a different job and a
 * different screen.
 *
 * The run sheet is seeded from the worship team's lineup for that Sunday, so
 * the tech team starts from what was already planned instead of retyping it.
 *
 * This page owns the live state. The output window renders whatever it is
 * given (views/PresentOutput.vue) and decides nothing, so the wall and the
 * booth can never disagree about what is showing.
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Play, X, Cards, Music2, Menu } from '../icons'
import { subscribeToSongs } from '../api/songsService'
import { subscribeToLineups } from '../api/lineupsService'
import {
  subscribeToServicePlan,
  saveServicePlan,
  deleteServicePlan,
} from '../api/servicePlansService'
import { auth } from '../api/firebase'
import { useToast } from '../composables/useToast'
import { usePermissions } from '../composables/usePermissions'
import { useDragReorder } from '../composables/useDragReorder'
import { formatServiceDate } from '../utils/lineupUtils'
import { DEFAULT_LINES_PER_SLIDE } from '../utils/songUtils'
import {
  PRESENTER_CHANNEL,
  buildDeck,
  runSheetFromSunday,
  ITEM_TYPES,
} from '../utils/presentation'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { canManage } = usePermissions()

const songs = ref([])
const lineups = ref([])
let unsubSongs = null
let unsubLineups = null

const songsById = computed(() =>
  Object.fromEntries(songs.value.map((song) => [String(song.id), song]))
)

/** Every Sunday that has a lineup, newest first — what there is to run. */
const sundays = computed(() =>
  lineups.value
    .flatMap((month) => month.sundays || [])
    .filter((sunday) => sunday.date)
    .sort((a, b) => b.date.localeCompare(a.date))
)

const selectedDate = ref(route.params.date || '')

watch(
  sundays,
  (list) => {
    if (!selectedDate.value && list.length) selectedDate.value = list[0].date
  },
  { immediate: true }
)

const sunday = computed(
  () => sundays.value.find((entry) => entry.date === selectedDate.value) || null
)

// How the words are sized and broken is a property of the room, not of the
// service: the screen size, how far back the last row is, how good the
// projector is. So it is remembered per machine rather than saved against a
// song or a Sunday — the booth laptop keeps its own calibration, and a
// different machine is free to differ.
const PREFS_KEY = 'uec-presenter-prefs'

const readPrefs = () => {
  try {
    return JSON.parse(window.localStorage.getItem(PREFS_KEY) || '{}')
  } catch {
    // Private window, or storage blocked. Defaults are fine; nothing breaks.
    return {}
  }
}

const savedPrefs = readPrefs()

const clamp = (value, min, max, fallback) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

const linesPerSlide = ref(clamp(savedPrefs.linesPerSlide, 1, 12, DEFAULT_LINES_PER_SLIDE))

// The run sheet: what the tech team is running, as opposed to what the worship
// team planned. A saved plan wins; without one the lineup is used as a starting
// point, so a Sunday nobody has touched still runs.
const items = ref([])
const plan = ref(null)
const isSavingPlan = ref(false)
let unsubPlan = null

/** True once the plan document for this date has reported back, empty or not.
 *  Seeding before that would flash the lineup and then replace it. */
const planLoaded = ref(false)

const canEditPlan = computed(() => canManage('lineups'))

const seedFromLineup = () => {
  items.value = sunday.value ? runSheetFromSunday(sunday.value, songsById.value) : []
}

watch(
  selectedDate,
  (date) => {
    unsubPlan?.()
    plan.value = null
    planLoaded.value = false
    items.value = []
    if (!date) return

    unsubPlan = subscribeToServicePlan(date, (saved) => {
      plan.value = saved
      // Only the first callback seeds. Later ones are this operator's own
      // writes coming back, and re-seeding on those would undo whatever was
      // edited in the meantime.
      if (planLoaded.value) return
      planLoaded.value = true
      if (saved) items.value = saved.items.map((item) => ({ ...item }))
      else seedFromLineup()
    })
  },
  { immediate: true }
)

// Songs and lineups arrive after the first paint, so a date that seeded from an
// empty lineup has to be seeded again once there is something to seed from.
watch([sunday, songsById], () => {
  if (planLoaded.value && !plan.value && !items.value.length) seedFromLineup()
})

const isPlanDirty = computed(() => {
  const saved = plan.value?.items
  if (!saved) return items.value.length > 0
  return JSON.stringify(saved) !== JSON.stringify(items.value)
})

const deck = computed(() =>
  buildDeck(items.value, { songsById: songsById.value, linesPerSlide: linesPerSlide.value })
)

// -1 means nothing is live, which is how a service starts and how it ends.
const liveIndex = ref(-1)
const isPresenting = ref(false)
// Whether the projector window was successfully placed on a second screen and
// therefore should be fullscreened once it is listening.
const wantsFullscreen = ref(false)
let channel = null
let output = null

const liveSlide = computed(() => deck.value[liveIndex.value] || null)

// How big the words are on the wall, as a percentage of the size worked out
// from the line count. A hall with a small screen at the back needs this down;
// a wide screen close up can take it up.
const TEXT_SCALE_MIN = 50
const TEXT_SCALE_MAX = 160
const TEXT_SCALE_STEP = 5

const textScale = ref(clamp(savedPrefs.textScale, TEXT_SCALE_MIN, TEXT_SCALE_MAX, 100))

/** Nudges the size by one step, for setting it without aiming at a slider —
 *  which is the harder thing to do in a dark booth. */
const nudgeTextSize = (delta) => {
  textScale.value = clamp(
    textScale.value + delta * TEXT_SCALE_STEP,
    TEXT_SCALE_MIN,
    TEXT_SCALE_MAX,
    100
  )
}

// --- Video files -----------------------------------------------------------
// The file itself never reaches Firestore: a run sheet is a plan, not a media
// library, and a Sunday announcement is a few hundred megabytes. It is held in
// memory for the session and handed to the projector window over the same
// channel as everything else — a File survives postMessage, so it goes from
// booth to wall without a server or an upload in between.
//
// The consequence, stated plainly rather than hidden: the file has to be picked
// again next time the page loads. The name is stored on the item so the
// operator knows which one to look for.
const videoFiles = new Map()
// Which items currently have a file attached, as something the template can
// react to — a Map is not reactive.
const attachedVideos = ref([])

const attachVideo = (item, file) => {
  if (!file) return
  videoFiles.set(item.id, file)
  attachedVideos.value = [...new Set([...attachedVideos.value, item.id])]
  // Remember what was chosen, so next week it is clear what is missing.
  items.value = items.value.map((entry) =>
    entry.id === item.id
      ? { ...entry, source: file.name, title: entry.title || file.name }
      : entry
  )
}

const hasVideoFile = (itemId) => attachedVideos.value.includes(itemId)

// Sending a file is expensive — postMessage copies it — so it goes once, when
// the video becomes live, not on every unrelated push such as a size change.
let sentVideoFor = null

const push = () => {
  if (!channel) return
  const slide = liveSlide.value

  if (!slide) {
    sentVideoFor = null
    channel.postMessage({ type: 'blank' })
    return
  }

  if (slide.itemType === 'video' && videoFiles.has(slide.itemId)) {
    if (sentVideoFor !== slide.itemId) {
      sentVideoFor = slide.itemId
      channel.postMessage({
        type: 'video',
        itemId: slide.itemId,
        file: videoFiles.get(slide.itemId),
      })
    }
    return
  }

  sentVideoFor = null
  channel.postMessage({ type: 'slide', slide, scale: textScale.value })
}

/** True when the wall is showing a video this booth can drive. */
const isVideoLive = computed(
  () => liveSlide.value?.itemType === 'video' && hasVideoFile(liveSlide.value.itemId)
)

const videoCommand = (action) => {
  channel?.postMessage({ type: 'video-control', action })
}

// Re-pushed on a size change too, or the wall keeps the old size until the
// next slide.
watch([liveIndex, textScale], push)

watch([linesPerSlide, textScale], () => {
  try {
    window.localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ linesPerSlide: linesPerSlide.value, textScale: textScale.value })
    )
  } catch {
    // Not worth telling the operator about: the setting still applies for this
    // session, it just will not be there next time.
  }
})

// What the operator is looking at, as opposed to what the congregation is.
// Clicking a slide selects it — deliberately harmless, so a stray click during
// a service cannot change the wall. Going live takes a double click.
const selectedIndex = ref(-1)

const show = (index) => {
  if (index < 0 || index >= deck.value.length) return
  liveIndex.value = index
  selectedIndex.value = index
}

const select = (index) => {
  if (index < 0 || index >= deck.value.length) return
  selectedIndex.value = index
}

/** The preview follows the selection when there is one, and the wall otherwise. */
const previewSlide = computed(
  () => deck.value[selectedIndex.value] || deck.value[liveIndex.value] || null
)

/** Where each run-sheet item starts in the deck, for the lineup column. */
const itemStarts = computed(() => {
  const starts = []
  deck.value.forEach((slide, index) => {
    if (index === 0 || deck.value[index - 1].itemId !== slide.itemId) {
      starts.push({ itemId: slide.itemId, title: slide.itemTitle, type: slide.itemType, index })
    }
  })
  return starts
})

/** Where an item's first slide sits in the deck, so the run sheet can jump to
 *  it. Items with nothing to project — an empty text item — have no entry. */
const startIndexOf = (itemId) =>
  itemStarts.value.find((entry) => entry.itemId === itemId)?.index ?? -1

/** Whether the preview column is open. Off by default: the run sheet and the
 *  slides are what an operator reads, and the wall is right there. */
const showPreview = ref(false)

/**
 * The item whose slides are on show. Every slide of every song at once was a
 * list nobody could find anything in — the lineup column exists to choose, and
 * this is what it chooses.
 *
 * Falls back to whatever is live, then to the first item, so the column is
 * never empty while there is something to run.
 */
const activeItemId = computed(
  () =>
    deck.value[selectedIndex.value]?.itemId ||
    deck.value[liveIndex.value]?.itemId ||
    deck.value[0]?.itemId ||
    null
)

const activeItemTitle = computed(
  () => deck.value.find((slide) => slide.itemId === activeItemId.value)?.itemTitle || ''
)

/**
 * The visible slides, each keeping the index it has in the whole deck.
 *
 * Navigation still runs on the full deck — advancing off the end of a song has
 * to reach the next one, because that is what a service does — so the index
 * cannot be re-based to this shorter list.
 */
const visibleSlides = computed(() =>
  deck.value
    .map((slide, index) => ({ slide, index }))
    .filter((entry) => entry.slide.itemId === activeItemId.value)
)

// The slides column scrolls, so advancing past its bottom edge would leave the
// operator looking at a list with the live slide somewhere off it. Keeping it in
// view matters most on the press where the song changes: the column re-renders
// around a different item, and without this the next verse arrives scrolled to
// wherever the last one happened to be.
const slidesPane = ref(null)

const scrollLiveIntoView = async () => {
  if (liveIndex.value < 0) return
  // After the DOM has caught up — a song change replaces every row here.
  await nextTick()
  slidesPane.value
    ?.querySelector(`[data-slide-index="${liveIndex.value}"]`)
    // 'nearest' scrolls only when it has to, so a slide already on screen does
    // not jump to the middle on every press. Instant, not smooth: an operator
    // pressing quickly would otherwise be watching animations queue up.
    ?.scrollIntoView({ block: 'nearest' })
}

watch(liveIndex, scrollLiveIntoView)

const next = () => show(liveIndex.value + 1)
const previous = () => show(liveIndex.value - 1)

// Blanking is a toggle, because the thing you always want next after blanking
// is the slide you blanked from — during a prayer, an announcement, a moment
// nobody should be reading a screen. Remembering where it left keeps that one
// key press away instead of hunting the slide down again.
const blankedFrom = ref(-1)

const toggleBlank = () => {
  if (liveIndex.value === -1) {
    if (blankedFrom.value >= 0) show(blankedFrom.value)
    return
  }
  blankedFrom.value = liveIndex.value
  liveIndex.value = -1
}

// --- Editing the run sheet -------------------------------------------------
// Songs come from the library by reference. Everything else — a reading, a
// notice, a video to hand over to — is typed here, because it exists only for
// this Sunday and the worship team never listed it.
const draftItem = ref(null)

const startAdding = (type) => {
  draftItem.value = {
    id: `item-${Date.now()}`,
    type,
    title: '',
    body: '',
    source: '',
    songId: '',
  }
}

const cancelDraft = () => {
  draftItem.value = null
}

const commitDraft = () => {
  const draft = draftItem.value
  if (!draft) return

  // A song carries neither title nor words of its own — it is a reference, and
  // both come from the library when it is projected. All it needs is which one.
  if (draft.type === 'song') {
    if (!draft.songId) {
      toast.warning('Choose a song first.')
      return
    }
    items.value = [...items.value, { ...draft }]
    draftItem.value = null
    return
  }

  // A cue is only a name and a place to find it; anything projected as text
  // needs the words, or it would put an empty screen up.
  const isCue = ITEM_TYPES[draft.type]?.renders === 'cue'
  if (isCue ? !draft.title.trim() : !draft.body.trim()) {
    toast.warning(isCue ? 'Give it a title first.' : 'Add the words to project.')
    return
  }

  items.value = [...items.value, { ...draft }]
  draftItem.value = null
}

const removeItem = (id) => {
  items.value = items.value.filter((item) => item.id !== id)
}

const savePlan = async () => {
  if (!selectedDate.value || isSavingPlan.value) return
  isSavingPlan.value = true
  try {
    await saveServicePlan(selectedDate.value, items.value, auth.currentUser)
    toast.success('Run sheet saved.')
  } catch {
    toast.error('Could not save the run sheet.')
  } finally {
    isSavingPlan.value = false
  }
}

/** Throws the run sheet away and follows the worship team's lineup again. */
const resetToLineup = async () => {
  try {
    if (plan.value) await deleteServicePlan(selectedDate.value)
    plan.value = null
    seedFromLineup()
    toast.success('Back to the lineup.')
  } catch {
    toast.error('Could not reset.')
  }
}

// Reordering the run sheet is the same gesture as reordering anything else.
const { draggingIndex: draggingItem, dragTarget, dragHandle } = useDragReorder(
  () => items.value,
  (next) => {
    items.value = next
  }
)

// --- Finding the projector -------------------------------------------------
// Screen details are fetched ahead of the click, not during it. A window opened
// with left/top already on the projector lands there; one opened on this screen
// and then moved often does not, because moving a window across screens is the
// part browsers restrict hardest. But the details cannot be awaited inside the
// click either — that spends the user activation and the pop-up gets blocked.
// So: resolve them on load where the permission allows it, and fall back to
// asking on the first press so the second press works.
// The live ScreenDetails object is held in a plain variable, never in a ref.
// Vue deep-wraps a ref's contents in a reactive Proxy, and this object's
// properties are native getters — invoked with a Proxy as `this` they stop
// returning real values. `screens.length` still worked (a plain array), so the
// page cheerfully reported "2 screens" while every `screen.left` read back
// undefined and the projector could never be identified.
//
// What goes into reactive state is a plain snapshot, which is safe to proxy.
let screenDetailsRaw = null

/** Plain copies: { availLeft, availTop, availWidth, availHeight, isCurrent }. */
const screens = ref([])

// The exact feature string handed to window.open. Shown on the page because a
// placement that is accepted and then ignored is otherwise indistinguishable
// from one that was aimed at the wrong coordinates.
const lastFeatures = ref('')

// Placeholder outputs that were thrown away, so the count on screen can be
// explained rather than just being smaller than the operator expected.
const ignoredScreens = ref(0)

const screenCount = computed(() => screens.value.length || 1)

// Whether the browser has the API at all. Chrome and Edge do; Firefox and
// Safari do not, and Brave ships it disabled because it can be used to
// fingerprint a machine. Where it is missing there is no permission to grant
// and no prompt to see, which is worth saying plainly rather than leaving the
// operator hunting for a dialog that cannot appear.
const canPlaceWindows = typeof window !== 'undefined' && 'getScreenDetails' in window

/** 'unsupported' | 'prompt' | 'granted' | 'denied' | 'unknown' */
const permissionState = ref(canPlaceWindows ? 'unknown' : 'unsupported')

const screenStatus = computed(() => {
  if (permissionState.value === 'unsupported') {
    return 'This browser cannot place windows — drag the projector window across by hand.'
  }
  if (permissionState.value === 'denied') {
    return 'Screen access was blocked. Allow it from the icon in the address bar.'
  }
  if (screenCount.value > 1) {
    return `${screenCount.value} screens — Present opens on the projector.`
  }
  if (permissionState.value === 'granted') {
    return ignoredScreens.value
      ? 'One usable screen. Windows is reporting another output with no size — that is a ' +
        'disconnected or duplicated display, not somewhere a window can go. Check the ' +
        'projector is plugged in and set to Extend, not Duplicate.'
      : 'One screen detected. Plug the projector in and this updates on its own.'
  }
  return 'Screens not detected yet — press Detect screens to allow it.'
})

/**
 * Copies the current layout into plain objects.
 *
 * `isCurrent` is decided here, by real object identity against
 * `details.currentScreen`, while these are still the browser's own objects and
 * their getters work.
 */
const snapshotScreens = () => {
  if (!screenDetailsRaw) return
  try {
    const current = screenDetailsRaw.currentScreen
    // Compared by position, not by `screen === current`. currentScreen can
    // return a fresh wrapper rather than the instance held in `screens`, and
    // when it does, identity marks nothing as current — so "the screen this
    // window is not on" picked the first entry, which is display 1. The window
    // then opened exactly where it started while reporting success.
    const currentLeft = current?.left
    const currentTop = current?.top

    // Windows reports placeholder outputs — a disconnected port, a virtual
    // adapter — as screens of zero size at the origin. Those are not somewhere
    // a window can be put, and counting them made the page announce "2 screens"
    // when there was only one to present on.
    //
    // But a real display can also report an odd size briefly, right after being
    // plugged in. So size alone is not the test: what disqualifies a screen is
    // sitting at the same position as this one AND having no usable size. A
    // screen with its own position is somewhere a window can go, whatever it
    // says about its dimensions.
    const hasSize = (screen) => screen.availWidth > 320 && screen.availHeight > 240
    const ownPosition = (screen) => screen.left !== currentLeft || screen.top !== currentTop
    const usable = (screen) => hasSize(screen) || ownPosition(screen)

    ignoredScreens.value = screenDetailsRaw.screens.filter((screen) => !usable(screen)).length

    screens.value = screenDetailsRaw.screens.filter(usable).map((screen) => ({
      left: screen.left,
      top: screen.top,
      availLeft: screen.availLeft,
      availTop: screen.availTop,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      label: screen.label || '',
      isCurrent: screen.left === currentLeft && screen.top === currentTop,
    }))

    // If nothing matched, no screen can be trusted as "the other one".
    if (screens.value.length && !screens.value.some((screen) => screen.isCurrent)) {
      screens.value = screens.value.map((screen, index) => ({
        ...screen,
        isCurrent: index === 0,
      }))
    }
  } catch {
    screens.value = []
  }
}

/**
 * The screen this window is not on — never chosen by `isPrimary`, since plenty
 * of setups make the projector the primary display.
 */
const projectorScreen = () => {
  const current = screens.value.find((screen) => screen.isCurrent)
  return (
    screens.value.find(
      (screen) =>
        !screen.isCurrent &&
        // Mirrored displays report two screens at one position. There is
        // nowhere to place a window onto, so this is not a projector.
        (!current || screen.left !== current.left || screen.top !== current.top)
    ) || null
  )
}

const loadScreens = async () => {
  if (!('getScreenDetails' in window)) return null
  try {
    screenDetailsRaw = await window.getScreenDetails()
    snapshotScreens()
    // Plugging the projector in after the page loaded must not leave us stale.
    screenDetailsRaw.addEventListener?.('screenschange', snapshotScreens)
    return screenDetailsRaw
  } catch {
    return null
  }
}

/**
 * Asks for screen access from a real click.
 *
 * The prompt needs a user gesture, and the load-time query deliberately does
 * not provoke one. This button is where the operator opts in — and where they
 * find out the browser has no such thing to offer.
 */
const detectScreens = async () => {
  if (!canPlaceWindows) {
    toast.warning('This browser cannot place windows on another screen.')
    return
  }
  const details = await loadScreens()
  if (!details) {
    permissionState.value = 'denied'
    toast.error('Screen access was refused. Check the address bar for a blocked-permission icon.')
    return
  }
  permissionState.value = 'granted'

  // If a projector window is already open, move it now rather than making the
  // operator stop and start the presentation again.
  const target = projectorScreen()
  if (output && target) {
    placeOnProjector(target)
    toast.success(`${screenCount.value} screens found — moved to the projector.`)
    return
  }

  toast.success(
    screenCount.value > 1
      ? `${screenCount.value} screens found. Present will open on the projector.`
      : 'Allowed, but only one screen is connected right now.'
  )
}

const placeOnProjector = (target) => {
  if (!output || !target) return
  // Some builds ignore left/top given to window.open, so this is repeated.
  output.moveTo(target.availLeft, target.availTop)
  output.resizeTo(target.availWidth, target.availHeight)
  // Fullscreen can only be called inside that window, so it is asked over the
  // same channel the slides travel on — and again on `ready`, because
  // placement finishes before that window has mounted its listener.
  wantsFullscreen.value = true
  channel?.postMessage({ type: 'fullscreen' })
}

/**
 * Opens the projector window, on the projector, fullscreen.
 *
 * Deliberately synchronous, and it never asks for the screen permission. An
 * earlier version tried to: it opened the window, focused it, and only then
 * called getScreenDetails(). Focusing the new window leaves this one without
 * the user activation that call needs the first time, so it threw every time
 * and the placement was silently skipped.
 *
 * Asking now belongs to `detectScreens`, on its own clean click. Here the
 * screens are either already known — in which case the window is born in the
 * right place — or they are not, and the operator is pointed at that button.
 */
const present = () => {
  // Dragging this window to the other screen changes which one is current and
  // raises no event, so the layout is re-read at the moment it matters.
  snapshotScreens()
  const target = projectorScreen()

  // A named window, so pressing Present twice focuses the existing screen
  // rather than stacking a second one on the projector.
  // Any window left over from an earlier run is asked to close first. Calling
  // window.open with a name that already exists returns that window and
  // ignores the feature string entirely — including the position — so reusing
  // a fixed name is why a placement can be accepted and then do nothing. The
  // name is unique per launch for the same reason.
  channel?.postMessage({ type: 'close' })

  // A display that reports its position but not its size still gets a window;
  // 1280x720 is a guess the operator can resize, and better than 0x0.
  const width = target?.availWidth > 320 ? target.availWidth : 1280
  const height = target?.availHeight > 240 ? target.availHeight : 720

  const features = target
    ? `popup=yes,left=${target.availLeft},top=${target.availTop},width=${width},height=${height}`
    : 'popup=yes,width=1280,height=720'

  lastFeatures.value = features
  // ?fs=1 tells that window to go fullscreen on load. Sent in the URL rather
  // than as a message because a message can arrive after the inherited user
  // activation has lapsed, and the request is then refused.
  output = window.open(
    target ? '/present-output?fs=1' : '/present-output',
    `uec-presenter-${Date.now()}`,
    features
  )

  if (!output) {
    toast.error('The browser blocked the presenter window. Allow pop-ups for this site.')
    return
  }
  isPresenting.value = true

  if (target) {
    placeOnProjector(target)
    toast.success(`Presenting on ${target.label || `screen at ${target.availLeft},${target.availTop}`}.`)
  } else if (canPlaceWindows && permissionState.value !== 'granted') {
    toast.warning('Press "Detect screens" to let it open on the projector by itself.')
  } else {
    toast.success('Drag the window to the projector, then click it for fullscreen.')
  }

  // Focused last: doing this before the checks above cost the activation that
  // the screen permission needs.
  output.focus()
}

const presentOrFocus = () => {
  if (isPresenting.value && output && !output.closed) {
    output.focus()
    return
  }
  present()
}

const stopPresenting = () => {
  channel?.postMessage({ type: 'close' })
  output?.close?.()
  output = null
  isPresenting.value = false
  wantsFullscreen.value = false
  liveIndex.value = -1
}

const onKey = (event) => {
  if (event.target?.matches?.('input, textarea, select')) return
  const keys = {
    ArrowRight: next,
    ArrowDown: next,
    PageDown: next,
    ' ': next,
    ArrowLeft: previous,
    ArrowUp: previous,
    PageUp: previous,
    b: toggleBlank,
    B: toggleBlank,
    // Commits whatever is selected. The pair with double-click: a click alone
    // never changes the wall, so there has to be a keyboard way to say "now".
    Enter: () => show(selectedIndex.value),
    // Starts the projector, or brings it back to the front if it wandered
    // behind something. Never stops it: ending a presentation mid-service by
    // brushing a key is not a mistake worth making possible.
    p: presentOrFocus,
    P: presentOrFocus,
  }
  const action = keys[event.key]
  if (!action) return
  event.preventDefault()
  action()
}

onMounted(() => {
  unsubSongs = subscribeToSongs((data) => {
    songs.value = data
  })
  unsubLineups = subscribeToLineups((data) => {
    lineups.value = data
  })

  channel = new BroadcastChannel(PRESENTER_CHANNEL)
  channel.onmessage = (event) => {
    // The output window announces itself on load; answer with what is live so
    // it does not sit black until the next press.
    if (event.data?.type === 'ready') {
      isPresenting.value = true
      push()
      if (wantsFullscreen.value) channel.postMessage({ type: 'fullscreen' })
    }
    // Fullscreen is automatic; the operator only hears about it when the
    // browser refused, because that is the only time they have to do anything.
    if (event.data?.type === 'video-muted') {
      toast.warning('The video is playing muted — click the projector window once for sound.')
    }
    if (event.data?.type === 'fullscreen-result' && event.data.ok === false) {
      toast.warning('The projector window opened but could not go fullscreen — click it once.')
    }
  }

  window.addEventListener('keydown', onKey)
  // Coming back to the tab is the cheapest moment to notice a display that was
  // connected while it was in the background.
  window.addEventListener('focus', snapshotScreens)

  // Where the permission has already been given, this resolves without a
  // prompt, so the very first Present can open straight onto the projector.
  // Querying first avoids provoking a prompt on page load, which would be an
  // odd thing to meet just for opening the tech page.
  navigator.permissions
    ?.query?.({ name: 'window-management' })
    .then((status) => {
      permissionState.value = status.state
      if (status.state === 'granted') loadScreens()
      // Granting it in the address bar mid-service should take effect without
      // a reload.
      status.onchange = () => {
        permissionState.value = status.state
        if (status.state === 'granted') loadScreens()
      }
    })
    .catch(() => {
      // Older Chrome called it "window-placement"; anything else simply has no
      // such permission and finds out on the first press.
      navigator.permissions
        ?.query?.({ name: 'window-placement' })
        .then((status) => {
          if (status.state === 'granted') loadScreens()
        })
        .catch(() => {})
    })
})

onUnmounted(() => {
  unsubSongs?.()
  unsubLineups?.()
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('focus', snapshotScreens)
  channel?.close()
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div
      class="shrink-0 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800"
    >
      <div class="flex flex-wrap items-center gap-3">
        <button
          @click="router.push('/lineups')"
          aria-label="Back to lineups"
          class="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-primary dark:hover:bg-gray-700"
        >
          <ArrowLeft class="h-5 w-5" />
        </button>

        <div class="min-w-0">
          <h1 class="text-sm font-bold text-gray-900 dark:text-white">Presenter</h1>
          <p class="text-xs font-medium text-gray-400">
            {{ deck.length }} slide{{ deck.length === 1 ? '' : 's' }}
            <span v-if="screenCount > 1">· {{ screenCount }} screens</span>
            <span v-if="isPresenting" class="text-emerald-600 dark:text-emerald-400">· live</span>
          </p>
        </div>

        <select
          v-model="selectedDate"
          class="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        >
          <option v-for="entry in sundays" :key="entry.date" :value="entry.date">
            {{ formatServiceDate(entry.date) }}
          </option>
        </select>

        <div class="ml-auto flex items-center gap-2">
          <button
            @click="toggleBlank"
            :class="[
              'rounded-xl px-3 py-2 text-xs font-bold transition-colors',
              liveIndex === -1
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
            ]"
            :title="liveIndex === -1 ? 'Show the slide again (B)' : 'Blank the screen (B)'"
          >
            {{ liveIndex === -1 ? 'Unblank' : 'Blank' }}
          </button>
          <button
            @click="showPreview = !showPreview"
            :class="[
              'rounded-xl px-3 py-2 text-xs font-bold transition-colors',
              showPreview
                ? 'bg-primary/15 text-primary'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
            ]"
            title="Show what the wall is showing"
          >
            Preview
          </button>
          <button
            v-if="!isPresenting"
            @click="present"
            class="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-hover"
          >
            <Play class="h-3.5 w-3.5" />
            Present
          </button>
          <button
            v-else
            @click="stopPresenting"
            class="flex items-center gap-1.5 rounded-xl bg-red-500 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-red-600"
          >
            <X class="h-3.5 w-3.5" />
            Stop
          </button>
        </div>
      </div>
    </div>

    <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
      <!-- The run sheet: what is being run, in order. Songs arrive from the
           worship team's lineup; everything else is added here, because a
           reading or a notice is the tech team's to plan and was never on the
           musicians' list. -->
      <div
        class="custom-scrollbar min-h-0 shrink-0 overflow-y-auto border-b border-gray-200 p-3 dark:border-gray-700 lg:w-64 lg:border-b-0 lg:border-r"
      >
        <div class="mb-2 flex items-center justify-between gap-2 px-1">
          <p class="text-xs font-bold uppercase tracking-wide text-gray-400">Run sheet</p>
          <button
            v-if="canEditPlan && isPlanDirty"
            @click="savePlan"
            :disabled="isSavingPlan"
            class="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
          >
            {{ isSavingPlan ? 'Saving' : 'Save' }}
          </button>
          <span v-else-if="plan" class="text-[11px] font-medium text-gray-400">Saved</span>
          <span v-else class="text-[11px] font-medium text-gray-400">From lineup</span>
        </div>

        <p v-if="!items.length" class="px-1 text-xs text-gray-400">
          Nothing planned for this date yet.
        </p>

        <div v-else class="space-y-1">
          <div
            v-for="(item, index) in items"
            :key="item.id"
            v-bind="canEditPlan ? dragTarget(index) : {}"
            :class="[
              'group flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-bold transition-colors',
              liveSlide && liveSlide.itemId === item.id
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700',
              draggingItem === index ? 'opacity-80 shadow-lg ring-2 ring-primary/40' : '',
            ]"
          >
            <span
              v-if="canEditPlan"
              v-bind="dragHandle(index)"
              aria-label="Drag to reorder"
              class="shrink-0 cursor-grab text-gray-300 transition-colors hover:text-gray-500 active:cursor-grabbing dark:text-gray-600 dark:hover:text-gray-400"
            >
              <Menu class="h-3.5 w-3.5" />
            </span>

            <Music2 v-if="item.type === 'song'" class="h-3.5 w-3.5 shrink-0" />
            <Cards v-else class="h-3.5 w-3.5 shrink-0" />

            <button
              @click="select(startIndexOf(item.id))"
              @dblclick="show(startIndexOf(item.id))"
              class="min-w-0 flex-1 truncate text-left"
            >
              {{ item.title || ITEM_TYPES[item.type]?.label }}
            </button>

            <!-- The file lives in this tab only, so it is picked per session.
                 A tick means the projector can play it; a dot means the run
                 sheet expects a file that has not been chosen yet. -->
            <label
              v-if="canEditPlan && item.type === 'video'"
              :title="hasVideoFile(item.id) ? 'Video ready' : `Choose ${item.source || 'a video file'}`"
              class="shrink-0 cursor-pointer rounded px-1 text-[11px] font-bold transition-colors"
              :class="hasVideoFile(item.id) ? 'text-emerald-600' : 'text-amber-600 hover:text-amber-700'"
            >
              {{ hasVideoFile(item.id) ? '&check;' : '&bull;' }}
              <input
                type="file"
                accept="video/*"
                class="hidden"
                @change="attachVideo(item, $event.target.files?.[0])"
              />
            </label>

            <button
              v-if="canEditPlan"
              @click="removeItem(item.id)"
              aria-label="Remove from the run sheet"
              class="shrink-0 rounded px-1 text-gray-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
            >
              &times;
            </button>
          </div>
        </div>

        <!-- Adding something that is not a song. -->
        <div v-if="canEditPlan" class="mt-3 border-t border-gray-100 pt-3 dark:border-gray-700/60">
          <div v-if="!draftItem" class="flex flex-wrap gap-1">
            <button
              v-for="(meta, type) in ITEM_TYPES"
              :key="type"
              @click="startAdding(type)"
              class="rounded-full border border-dashed border-gray-300 px-2 py-1 text-[11px] font-bold text-gray-500 transition-colors hover:border-primary hover:text-primary dark:border-gray-600"
            >
              + {{ meta.label }}
            </button>
          </div>

          <!-- One form, shaped by the type: a song is chosen, a reading is
               typed, a video is a name and somewhere to find it. -->
          <div v-else class="space-y-2 rounded-xl border-2 border-primary/30 bg-primary/5 p-2.5">
            <p class="text-[11px] font-bold uppercase tracking-wide text-primary">
              {{ ITEM_TYPES[draftItem.type]?.label }}
            </p>

            <select
              v-if="draftItem.type === 'song'"
              v-model="draftItem.songId"
              class="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option value="">Choose a song…</option>
              <option v-for="song in songs" :key="song.id" :value="song.id">
                {{ song.title }}
              </option>
            </select>

            <input
              v-else
              v-model="draftItem.title"
              type="text"
              placeholder="Title"
              class="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />

            <textarea
              v-if="ITEM_TYPES[draftItem.type]?.renders === 'text' && draftItem.type !== 'song'"
              v-model="draftItem.body"
              rows="4"
              placeholder="The words to project. A blank line starts a new slide."
              class="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs leading-relaxed text-gray-900 outline-none focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            ></textarea>

            <input
              v-if="ITEM_TYPES[draftItem.type]?.renders === 'cue'"
              v-model="draftItem.source"
              type="url"
              placeholder="Link to the video or deck (optional)"
              class="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />

            <div class="flex gap-1.5">
              <button
                @click="commitDraft"
                class="flex-1 rounded-lg bg-primary py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-primary-hover"
              >
                Add
              </button>
              <button
                @click="cancelDraft"
                class="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-gray-500 transition-colors hover:text-gray-700 dark:hover:text-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>

          <button
            v-if="plan"
            @click="resetToLineup"
            class="mt-2 w-full rounded-lg px-2 py-1 text-[11px] font-bold text-gray-400 transition-colors hover:text-red-500"
          >
            Reset to the lineup
          </button>
        </div>
      </div>

      <!-- The selected item's slides, and only those. The whole service at once
           was a list nobody could find anything in; choosing what to look at is
           what the lineup column is for. Navigation still crosses items, so the
           end of one song runs into the next. -->
      <div ref="slidesPane" class="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
        <p v-if="!deck.length" class="py-8 text-center text-sm text-gray-400">
          Nothing to run yet — no songs with lyrics on this date.
        </p>

        <template v-else>
          <p
            class="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-400"
          >
            <Music2 v-if="visibleSlides[0]?.slide.itemType === 'song'" class="h-3 w-3" />
            <Cards v-else class="h-3 w-3" />
            {{ activeItemTitle }}
            <span class="font-medium normal-case text-gray-400">
              · {{ visibleSlides.length }} slide{{ visibleSlides.length === 1 ? '' : 's' }}
            </span>
          </p>

          <div class="space-y-1.5">
            <template v-for="{ slide, index } in visibleSlides" :key="slide.id">
            <button
              :data-slide-index="index"
              @click="select(index)"
              @dblclick="show(index)"
              :class="[
                'w-full rounded-xl border-2 p-3 text-left transition-colors',
                index === liveIndex
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                  : index === selectedIndex
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 bg-gray-50 hover:border-primary/40 dark:border-gray-700 dark:bg-gray-900',
              ]"
            >
              <div class="mb-1 flex items-center justify-between gap-2">
                <span
                  class="text-[11px] font-bold uppercase tracking-wide text-primary dark:text-primary-light"
                >
                  {{ slide.label }}
                  <span v-if="slide.part" class="ml-1 font-medium text-gray-400">{{
                    slide.part
                  }}</span>
                </span>
                <span v-if="index === liveIndex" class="text-[10px] font-bold text-emerald-600">
                  LIVE
                </span>
              </div>
              <pre
                v-if="slide.text"
                class="whitespace-pre-wrap break-words font-sans text-sm leading-snug text-gray-700 dark:text-gray-200"
                >{{ slide.text }}</pre
              >
              <p v-else class="text-xs italic text-gray-400">
                {{ ITEM_TYPES[slide.itemType]?.label }} — plays outside the lyric screen
              </p>
            </button>
            </template>
          </div>
        </template>
      </div>

      <!-- Optional, because the wall itself is in the room. Its use is checking
           a slide before committing it, which is what selecting one is for. -->
      <div
        v-if="showPreview"
        class="custom-scrollbar min-h-0 shrink-0 overflow-y-auto border-t border-gray-200 p-4 dark:border-gray-700 lg:w-1/3 lg:border-l lg:border-t-0"
      >
        <p class="mb-2 text-xs font-bold text-gray-500 dark:text-gray-400">
          {{ selectedIndex < 0 || selectedIndex === liveIndex ? 'On screen' : 'Selected' }}
        </p>

        <div
          class="flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl bg-black p-4"
        >
          <div
            v-if="previewSlide?.kind === 'text' && previewSlide.lines.length"
            class="w-full text-center font-bold leading-tight text-white"
            :style="{
              fontSize: `${(Math.min(2.2, 11 / (previewSlide.lines.length + 2.2)) * textScale) / 100}rem`,
            }"
          >
            <div v-for="(line, i) in previewSlide.lines" :key="i">{{ line }}</div>
          </div>
          <p
            v-else-if="previewSlide?.kind === 'cue'"
            class="text-xs uppercase tracking-widest text-white/30"
          >
            {{ previewSlide.label }}
          </p>
          <p v-else class="text-xs font-bold uppercase tracking-widest text-white/20">Blank</p>
        </div>

        <p
          v-if="selectedIndex >= 0 && selectedIndex !== liveIndex"
          class="mt-2 text-xs text-gray-400"
        >
          Not on the wall yet — double-click it, or press Enter.
        </p>
      </div>
    </div>

    <!-- Controls stay put whether or not the preview is open. -->
    <div
      class="shrink-0 border-t border-gray-200 bg-white px-4 py-2.5 dark:border-gray-700 dark:bg-gray-800"
    >
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div class="flex items-center gap-2">
          <button
            @click="previous"
            :disabled="liveIndex <= 0"
            class="rounded-xl bg-gray-100 px-4 py-2 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:disabled:hover:bg-gray-700"
          >
            Previous
          </button>
          <button
            @click="next"
            :disabled="liveIndex >= deck.length - 1"
            class="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-hover disabled:opacity-40 disabled:hover:bg-primary"
          >
            Next
          </button>
        </div>

        <!-- Only while a video is live: the slide controls do not apply to it,
             and these do not apply to anything else. -->
        <div v-if="isVideoLive" class="flex items-center gap-1.5">
          <button
            @click="videoCommand('play')"
            class="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-600"
          >
            Play
          </button>
          <button
            @click="videoCommand('pause')"
            class="rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Pause
          </button>
          <button
            @click="videoCommand('restart')"
            class="rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Restart
          </button>
        </div>

        <label class="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400">
          Lines
          <select
            v-model.number="linesPerSlide"
            class="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          >
            <option :value="2">2</option>
            <option :value="4">4</option>
            <option :value="6">6</option>
            <option :value="8">8</option>
          </select>
        </label>

        <!-- Applied on the wall as it moves, so it can be set from the back of
             the hall while watching the screen. -->
        <label class="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
          Text size
          <button
            @click="nudgeTextSize(-1)"
            :disabled="textScale <= TEXT_SCALE_MIN"
            aria-label="Smaller text"
            class="h-7 w-7 rounded-lg bg-gray-100 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:disabled:hover:bg-gray-700"
          >
            &minus;
          </button>
          <input
            v-model.number="textScale"
            type="range"
            :min="TEXT_SCALE_MIN"
            :max="TEXT_SCALE_MAX"
            :step="TEXT_SCALE_STEP"
            class="w-24 accent-primary"
          />
          <button
            @click="nudgeTextSize(1)"
            :disabled="textScale >= TEXT_SCALE_MAX"
            aria-label="Bigger text"
            class="h-7 w-7 rounded-lg bg-gray-100 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:disabled:hover:bg-gray-700"
          >
            +
          </button>
          <span class="w-9 tabular-nums text-gray-400">{{ textScale }}%</span>
        </label>

        <p class="ml-auto text-xs text-gray-400">
          Arrows advance · B blanks and unblanks · Enter shows the selected slide · P presents
        </p>
      </div>

      <!-- Where the projector window will go, and why. A prompt that never
           appears is otherwise indistinguishable from one that was missed. -->
      <div
        class="mt-2 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2 dark:border-gray-700/60"
      >
        <p
          class="text-[11px]"
          :class="
            permissionState === 'unsupported' || permissionState === 'denied'
              ? 'font-bold text-amber-700 dark:text-amber-400'
              : 'text-gray-400'
          "
        >
          {{ screenStatus }}
        </p>
        <button
          v-if="canPlaceWindows"
          @click="detectScreens"
          class="rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary transition-colors hover:bg-primary/20"
        >
          {{ screenCount > 1 ? 'Re-detect' : 'Detect screens' }}
        </button>
        <span v-for="(screen, i) in screens" :key="i" class="text-[11px] text-gray-400">
          {{ screen.isCurrent ? 'this' : 'projector' }} {{ screen.availLeft }},{{ screen.availTop }}
          · {{ screen.availWidth }}&times;{{ screen.availHeight }}
        </span>
      </div>
    </div>
  </div>
</template>
