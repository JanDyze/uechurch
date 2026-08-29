import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAuth } from './useAuth'
import {
  DEFAULT_DIGEST_PREFS,
  DIGEST_KINDS,
  saveDigestPrefs,
  sendActivityReport,
  sendDigestNow,
  subscribeToDigestPrefs,
  subscribeToMailLog,
} from '../api/emailService'

// Module-level, like useAdmins: the Topbar bell and the Settings panel both
// show the same switch, and there is no reason for each to open its own
// listener on the account document.
const prefs = ref({ ...DEFAULT_DIGEST_PREFS })
const loading = ref(true)
let unsubscribe = null
let subscribers = 0
let boundUid = null

const bind = (uid) => {
  unsubscribe?.()
  unsubscribe = null
  boundUid = uid || null

  if (!uid) {
    prefs.value = { ...DEFAULT_DIGEST_PREFS }
    loading.value = false
    return
  }

  loading.value = true
  unsubscribe = subscribeToDigestPrefs(uid, (next) => {
    prefs.value = next
    loading.value = false
  })
}

export function useEmailDigest() {
  const { user } = useAuth()

  onMounted(() => {
    subscribers += 1
    if (user.value?.uid !== boundUid) bind(user.value?.uid)
  })

  // Follows sign-in and sign-out. Several components run this watcher, so the
  // uid check keeps a single rebind from happening once per caller.
  watch(
    () => user.value?.uid,
    (uid) => {
      if (subscribers > 0 && uid !== boundUid) bind(uid)
    }
  )

  onUnmounted(() => {
    subscribers -= 1
    if (subscribers <= 0) {
      unsubscribe?.()
      unsubscribe = null
      boundUid = null
      subscribers = 0
    }
  })

  const saving = ref(false)
  const isEnabled = computed(() => prefs.value.enabled === true)

  const write = async (next) => {
    if (!user.value?.uid) throw new Error('Sign in required')
    saving.value = true
    // Optimistic: the switch should move under the thumb, not after a
    // round-trip. The snapshot listener corrects it if the write is refused.
    const previous = prefs.value
    prefs.value = { ...prefs.value, ...next }
    try {
      await saveDigestPrefs(user.value.uid, prefs.value)
    } catch (error) {
      prefs.value = previous
      throw error
    } finally {
      saving.value = false
    }
  }

  /** The master switch. Everything else is a refinement of it. */
  const setEnabled = (enabled) => write({ enabled })
  const toggleEnabled = () => write({ enabled: !isEnabled.value })
  /** Turn one of the three digests on or off without leaving the programme. */
  const setKind = (key, value) => write({ [key]: value })

  return {
    prefs,
    loading,
    saving,
    isEnabled,
    kinds: DIGEST_KINDS,
    setEnabled,
    toggleEnabled,
    setKind,
  }
}

/**
 * The administrator half: firing a digest early and mailing yourself the full
 * activity report. Kept apart from the preference state above because only the
 * Settings panel needs it, and it holds per-button progress rather than
 * anything shared.
 */
export function useEmailSending() {
  // Which action is in flight, so only the pressed button shows a spinner
  const busy = ref('')
  const log = ref([])
  const logLoading = ref(true)
  const logError = ref('')
  let unsubscribeLog = null

  onMounted(() => {
    unsubscribeLog = subscribeToMailLog(
      (entries) => {
        log.value = entries
        logLoading.value = false
      },
      {
        onError: (message) => {
          logError.value = message || ''
          logLoading.value = false
        },
      }
    )
  })

  onUnmounted(() => unsubscribeLog?.())

  const send = async (kind, options) => {
    busy.value = kind
    try {
      return await sendDigestNow(kind, options)
    } finally {
      busy.value = ''
    }
  }

  const sendActivity = async (range, options) => {
    busy.value = 'activity'
    try {
      return await sendActivityReport(range, options)
    } finally {
      busy.value = ''
    }
  }

  return { busy, log, logLoading, logError, send, sendActivity }
}
