import { computed, ref } from 'vue'
import { subscribeToAppSettings, saveAppSettings } from '../api/appSettingsService'
import { DEFAULT_CHURCH, DEFAULT_CATEGORIES } from '../data/appDefaults'
import bundledLogo from '../assets/uec-logo.png'
import { useTheme } from './useTheme'

// Module-level with an explicit init, like usePermissions: the church name is
// needed by plain utility modules (the spreadsheet exporters) that have no
// component lifecycle to subscribe from.
const stored = ref(null)
let started = false

export const initAppSettings = () => {
  if (started) return
  started = true
  subscribeToAppSettings((data) => {
    stored.value = data
  })
}

const churchOf = (data) => ({ ...DEFAULT_CHURCH, ...(data?.church || {}) })
const categoriesOf = (data) => ({ ...DEFAULT_CATEGORIES, ...(data?.categories || {}) })

/**
 * Non-reactive read for modules outside the component tree — the xlsx
 * exporters build a workbook once, at the moment the button is pressed.
 */
export const getChurchIdentity = () => churchOf(stored.value)

/** The uploaded logo, or the bundled one while none has been set. Everything
 *  that draws the mark reads this, so one upload changes them all at once. */
export const getChurchLogo = () => {
  const info = churchOf(stored.value)
  const lightLogo = info.logo || bundledLogo
  const darkLogo = info.logoDark || lightLogo
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  return isDark ? darkLogo : lightLogo
}

export function useAppSettings() {
  const { isDark } = useTheme()
  const church = computed(() => churchOf(stored.value))
  const lightLogoUrl = computed(() => church.value.logo || bundledLogo)
  const darkLogoUrl = computed(() => church.value.logoDark || lightLogoUrl.value)
  const logoUrl = computed(() => (isDark.value ? darkLogoUrl.value : lightLogoUrl.value))
  const hasCustomLogo = computed(() => Boolean(church.value.logo || church.value.logoDark))
  const categories = computed(() => categoriesOf(stored.value))

  // True once the document exists; until then the views run on defaults.
  const isConfigured = computed(() => stored.value !== null)

  const saveChurch = (church) => saveAppSettings({ church })
  const saveCategories = (categories) => saveAppSettings({ categories })
  // Nested maps merge, so writing the logo alone cannot drop the names.
  const saveLogo = (logo) => saveAppSettings({ church: { logo } })
  const saveLogoDark = (logoDark) => saveAppSettings({ church: { logoDark } })

  return {
    church,
    logoUrl,
    lightLogoUrl,
    darkLogoUrl,
    hasCustomLogo,
    categories,
    isConfigured,
    saveChurch,
    saveCategories,
    saveLogo,
    saveLogoDark,
  }
}
