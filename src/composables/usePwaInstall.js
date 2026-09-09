import { computed, ref, shallowRef } from 'vue'

/**
 * Whether the app is running as an installed PWA, and — when it is not — what
 * it would take to get there on this particular browser.
 *
 * There are two entirely different install stories to serve:
 *
 *   Chrome/Edge/Samsung fire `beforeinstallprompt`, which we hold on to so a
 *   button of ours can trigger the real install dialog later. The event is
 *   only offered once per page load and only when the browser considers the
 *   app installable, so it has to be caught at module scope — by the time a
 *   component mounts it has usually already been and gone.
 *
 *   Safari on iOS fires nothing and has no API at all. The only route is the
 *   user tapping Share > Add to Home Screen, so all we can do is say so.
 *
 * Everything here is module-level state shared by every caller: there is one
 * browser, one install state, one deferred event.
 */

const isBrowser = typeof window !== 'undefined'

// The prompt comes back on every open until the app is installed. That is the
// point of it — most people meet this app through a shared link, use it in a
// tab, and never learn there is a home-screen version — so a single "not now"
// is treated as "not now", not as "never".
//
// The escape hatch is the toggle: ticking it before closing buys a day of
// silence. A day rather than a fortnight because the two live together — a
// prompt you can silence for a long time has to be shy about reappearing, and
// one that reappears constantly has to be easy to silence properly.
const SNOOZE_MS = 24 * 60 * 60 * 1000
const SNOOZE_KEY = 'uec.installPrompt.snoozedUntil'

const ua = isBrowser ? navigator.userAgent : ''

/**
 * iPadOS 13+ reports itself as "Macintosh" and is indistinguishable from a
 * desktop Mac by user agent alone — except that a Mac has no touch points.
 */
export const isIos =
  /iphone|ipad|ipod/i.test(ua) ||
  (isBrowser && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/**
 * Facebook's and Instagram's in-app browsers have no Add to Home Screen at
 * all, and a link to this church's page is very often opened from one. Telling
 * someone to tap a Share button that isn't there is worse than saying nothing,
 * so these get their own instruction: open it in Safari first.
 */
export const isIosInAppBrowser =
  isIos && /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|Twitter/i.test(ua)

const displayModeQuery =
  isBrowser && window.matchMedia
    ? window.matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)')
    : null

const detectStandalone = () =>
  Boolean(
    displayModeQuery?.matches ||
      // iOS's own, pre-standard flag — the display-mode query above is not
      // answered honestly by older iOS versions.
      window.navigator.standalone === true ||
      // Trusted Web Activity: the app is an Android shell around this origin.
      document.referrer.startsWith('android-app://')
  )

const readSnooze = () => {
  if (!isBrowser) return 0
  try {
    return Number(localStorage.getItem(SNOOZE_KEY)) || 0
  } catch {
    // Private browsing and locked-down storage both throw here. A prompt that
    // cannot remember being dismissed is a nuisance; one that crashes the app
    // is worse.
    return 0
  }
}

const standalone = ref(isBrowser ? detectStandalone() : true)
const justInstalled = ref(false)
const snoozedUntil = ref(readSnooze())
// Closing without ticking the toggle hides the prompt for this run of the app
// only. Module state, so it survives navigating between routes and dies with
// the page — which is exactly "every open" measured in the way a user means it.
const closedThisSession = ref(false)
// shallowRef: the deferred event is a live browser object with a promise on
// it, and wrapping it in a reactive proxy breaks prompt().
const deferredPrompt = shallowRef(null)

if (isBrowser) {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Without this Chrome shows its own mini-infobar and ours would be the
    // second prompt on the screen.
    event.preventDefault()
    deferredPrompt.value = event
  })

  window.addEventListener('appinstalled', () => {
    justInstalled.value = true
    deferredPrompt.value = null
  })

  // Installing from the browser's own menu can flip an open tab into
  // standalone without a reload.
  displayModeQuery?.addEventListener?.('change', () => {
    standalone.value = detectStandalone()
  })
}

export function usePwaInstall() {
  const isStandalone = computed(() => standalone.value || justInstalled.value)

  /** Chrome and friends: we can open the real install dialog ourselves. */
  const canPromptDirectly = computed(() => Boolean(deferredPrompt.value))

  /** iOS: no dialog exists, so the banner has to teach the gesture instead. */
  const needsManualSteps = computed(() => isIos && !canPromptDirectly.value)

  const isSnoozed = computed(() => Date.now() < snoozedUntil.value)

  /**
   * Show the banner only when there is something the user can actually do:
   * either the browser has offered us a dialog, or it is an iOS browser where
   * the manual steps are real. Anything else — a desktop browser with no
   * install support, an already-installed app — gets nothing.
   */
  const shouldOfferInstall = computed(
    () =>
      !isStandalone.value &&
      !isSnoozed.value &&
      !closedThisSession.value &&
      (canPromptDirectly.value || needsManualSteps.value)
  )

  /**
   * Opens the browser's install dialog. Resolves to true when the app was
   * installed. The event is single-use — Chrome will fire a fresh one if the
   * user declines and the page is reloaded — so it is cleared either way.
   */
  const promptInstall = async () => {
    const event = deferredPrompt.value
    if (!event) return false

    deferredPrompt.value = null
    try {
      event.prompt()
      const { outcome } = await event.userChoice
      if (outcome === 'accepted') {
        justInstalled.value = true
        return true
      }
      // Closed for this run, but not for the day: the toggle is the only
      // thing that buys silence that outlives the session. Declining leaves
      // the deferred event spent anyway, so nothing reappears behind it.
      close()
      return false
    } catch {
      return false
    }
  }

  /**
   * Closes the prompt. `forToday` is the toggle: without it the prompt is back
   * on the next open, with it the app stays quiet for a day.
   */
  const close = ({ forToday = false } = {}) => {
    closedThisSession.value = true
    if (!forToday) return

    const until = Date.now() + SNOOZE_MS
    snoozedUntil.value = until
    try {
      localStorage.setItem(SNOOZE_KEY, String(until))
    } catch {
      // Storage is unavailable (private browsing, or site data switched off).
      // The session close above still stands, so the toggle degrades to a
      // dismissal rather than doing nothing at all.
    }
  }

  return {
    isStandalone,
    isIos,
    isIosInAppBrowser,
    canPromptDirectly,
    needsManualSteps,
    shouldOfferInstall,
    promptInstall,
    close,
  }
}
