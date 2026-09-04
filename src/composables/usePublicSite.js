import { computed, ref } from 'vue'
import { fetchPublicSite } from '../api/publicSiteService'
import { withChurchDefaults, withLandingDefaults } from '../data/appDefaults'
import { useAppSettings } from './useAppSettings'
import { useTheme } from './useTheme'
import bundledLogo from '../assets/uec-logo.png'

// What the page at "/" draws itself from, whoever is looking at it.
//
// Two sources, on purpose:
//
//   - The church's identity and the landing copy come from Firestore when the
//     viewer is signed in, so an admin editing Settings in one tab sees the
//     preview change in the other. A visitor cannot read Firestore at all, so
//     for them the same fields arrive from /api/public.
//   - The gatherings and the photos always come from /api/public. They are
//     filtered server-side — no locations, no member-only events, no album an
//     admin has not shared — and repeating that filtering in the browser would
//     be a second copy of the rule to keep in step.

const site = ref(null)
const loading = ref(true)
const failed = ref(false)
let started = false

/** Starts the one fetch. Safe to call from every component that needs it. */
export const initPublicSite = () => {
  if (started) return
  started = true
  fetchPublicSite()
    .then((data) => {
      site.value = data
    })
    .catch((error) => {
      console.error('Error loading the public page:', error)
      failed.value = true
    })
    .finally(() => {
      loading.value = false
    })
}

export function usePublicSite() {
  const { isDark } = useTheme()
  const {
    church: storedChurch,
    landing: storedLanding,
    logoUrl: storedLogoUrl,
    isConfigured,
  } = useAppSettings()

  const church = computed(() =>
    isConfigured.value ? storedChurch.value : withChurchDefaults(site.value?.church)
  )

  const landing = computed(() =>
    isConfigured.value ? storedLanding.value : withLandingDefaults(site.value?.landing)
  )

  // Signed in, the logo is a base64 string straight from the settings document;
  // to a visitor it is a URL the server serves the same bytes from. Both are
  // just something to put in a src, and both honour the dark variant.
  const logoUrl = computed(() => {
    if (isConfigured.value) return storedLogoUrl.value
    const light = site.value?.church?.logo || bundledLogo
    const dark = site.value?.church?.logoDark || light
    return isDark.value ? dark : light
  })

  /**
   * Whether the public page is switched on. `null` while that is still
   * unknown — the router lets "/" through on a cold load rather than making
   * every visitor wait, and the page finishes the decision once an answer
   * arrives.
   */
  const enabled = computed(() => {
    if (isConfigured.value) return storedLanding.value.enabled !== false
    if (site.value) return site.value.enabled !== false
    if (failed.value) return true
    return null
  })

  const gatherings = computed(() => site.value?.gatherings || [])
  const photos = computed(() => site.value?.photos || [])

  return { church, landing, logoUrl, enabled, gatherings, photos, loading, failed }
}
