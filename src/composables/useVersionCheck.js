import { ref, computed } from 'vue'
import { versionHistory } from '../data/versionHistory'

// package.json is the one version that matters; vite.config.js hands it over as
// __APP_VERSION__ at build time. Reading it from anywhere else invites a
// release where the modal and the Settings footer disagree.
const currentVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'

const STORAGE_KEY = 'uec.lastSeenVersion'

const SEMVER = /^\d+\.\d+\.\d+$/

const readSeen = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    // Anything that will not parse — most likely the literal "dev" left by a
    // local run, since __APP_VERSION__ is only substituted at build time — is
    // treated as never having seen anything. Comparing against it instead
    // yields NaN, which is never greater than zero, and would silently
    // suppress the modal on that install forever.
    return SEMVER.test(stored || '') ? stored : null
  } catch {
    // Private-mode Safari and a few locked-down Android webviews throw on
    // access. Treating that as "never seen" would show the modal on every
    // launch, which is worse than never showing it.
    return currentVersion
  }
}

const lastSeenVersion = ref(readSeen())
const isOpen = ref(false)

const compareVersions = (a, b) => {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0)
  }
  return 0
}

// Someone who was away for three releases should see all three, not only the
// newest — the release they skipped is the one holding the feature they cannot
// find.
const unseenReleases = computed(() => {
  if (!lastSeenVersion.value) return []
  return versionHistory.filter((r) => compareVersions(r.version, lastSeenVersion.value) > 0)
})

const hasUnseenReleases = computed(() => unseenReleases.value.length > 0)

// What the modal actually renders. Opened by a new build it is the catch-up;
// opened deliberately from Settings — where there is nothing unseen, because
// dismissing it is what marked it seen — it is the notes for this build, which
// is what someone reaching for "What's new" is asking to re-read.
const releasesToShow = computed(() => {
  if (hasUnseenReleases.value) return unseenReleases.value
  // Newest entry at or below the running build. Not simply the newest entry:
  // a release that went unlisted here would otherwise present the notes of a
  // version this install is not yet on.
  const current = versionHistory.find((r) => compareVersions(r.version, currentVersion) <= 0)
  return current ? [current] : []
})

export function useVersionCheck() {
  const markSeen = () => {
    lastSeenVersion.value = currentVersion
    try {
      localStorage.setItem(STORAGE_KEY, currentVersion)
    } catch {
      // Nothing to do — the modal simply reappears next launch.
    }
  }

  const open = () => {
    isOpen.value = true
  }

  const close = () => {
    isOpen.value = false
    markSeen()
  }

  // A fresh install has nothing to catch up on: telling a first-time user
  // what changed since a version they never ran is noise. Record where they
  // came in and stay quiet.
  const checkOnLaunch = () => {
    if (!lastSeenVersion.value) {
      markSeen()
      return
    }
    if (hasUnseenReleases.value) open()
  }

  return {
    isOpen,
    currentVersion,
    versionHistory,
    unseenReleases,
    hasUnseenReleases,
    releasesToShow,
    open,
    close,
    checkOnLaunch,
  }
}
