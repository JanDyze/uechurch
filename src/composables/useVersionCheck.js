import { ref, computed } from 'vue'
import { versionHistory, getCurrentVersion } from '../data/versionHistory'

const STORAGE_KEY = 'app_last_seen_version'

const showModal = ref(false)
const currentVersion = getCurrentVersion()
const lastSeenVersion = ref(localStorage.getItem(STORAGE_KEY) || null)

const hasNewVersion = computed(() => {
  return lastSeenVersion.value !== currentVersion.version
})

const newVersionInfo = computed(() => {
  if (!hasNewVersion.value) return null
  return currentVersion
})

export function useVersionCheck() {
  const openWhatsNew = () => {
    showModal.value = true
  }

  const closeWhatsNew = () => {
    showModal.value = false
    updateVersionSeen()
  }

  const updateVersionSeen = () => {
    localStorage.setItem(STORAGE_KEY, currentVersion.version)
    lastSeenVersion.value = currentVersion.version
  }

  const checkAndShowIfNewVersion = () => {
    if (hasNewVersion.value) {
      openWhatsNew()
    }
  }

  return {
    showModal,
    currentVersion,
    hasNewVersion,
    newVersionInfo,
    versionHistory,
    openWhatsNew,
    closeWhatsNew,
    updateVersionSeen,
    checkAndShowIfNewVersion,
  }
}
