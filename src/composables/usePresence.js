import { computed, ref } from 'vue'
import {
  removePresence,
  subscribeToPresence,
  updatePresence,
} from '../api/presenceService'
import { touchLastActive } from '../api/userAccountsService'
import { useAuth } from './useAuth'

// Presence used to live inline in the Topbar. It moved here when the avatar
// stack became a right-hand rail: the rail, the Topbar's unread-style badge
// and the Accounts page all need the same live list, and none of them should
// open a second listener or beat a second heartbeat.

const HEARTBEAT_MS = 30000
// Presence already answers "who is online now", so the account's activity
// stamp only has to be good enough to sort everyone who isn't.
const ACTIVITY_WRITE_MS = 5 * 60 * 1000
const SESSION_KEY = 'uec_visitor_session_id'

const sessionId = ref('')
const everyone = ref([])

/** Open state of the people rail on phones, where it is a drawer. */
export const showPeoplePanel = ref(false)

// Collapsed state of the permanent rail, mirroring the left sidebar's own
// minimize. Remembered per browser: someone who wants the width back for the
// content column should not have to reclaim it on every visit.
const RAIL_KEY = 'uec_people_rail_collapsed'
export const isRailCollapsed = ref(localStorage.getItem(RAIL_KEY) === '1')

export const toggleRail = () => {
  isRailCollapsed.value = !isRailCollapsed.value
  localStorage.setItem(RAIL_KEY, isRailCollapsed.value ? '1' : '0')
}

let started = false
let heartbeat = null
let unsubscribe = null
let handleUnload = null
let lastActivityWrite = 0

const getSessionId = () => {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = `session-${Math.random().toString(36).substring(2, 11)}`
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

// The presence record carries the account's identity, not a random persona, so
// the rail shows the same face and name as everywhere else in the app. The name
// is only ever read from the account — nothing in the UI can rewrite it.
const beat = async () => {
  const { user, displayName } = useAuth()
  if (!sessionId.value) return

  await updatePresence(sessionId.value, {
    name: displayName.value,
    uid: user.value?.uid || '',
    photoURL: user.value?.photoURL || '',
  })

  const uid = user.value?.uid
  if (uid && Date.now() - lastActivityWrite > ACTIVITY_WRITE_MS) {
    lastActivityWrite = Date.now()
    touchLastActive(uid).catch((error) =>
      console.error('Error stamping account activity:', error)
    )
  }
}

/** Starts the heartbeat and the live subscription. Safe to call more than once. */
export const initPresence = () => {
  if (started) return
  started = true

  // Leftover from the old random-persona presence
  localStorage.removeItem('uec_visitor_animal')
  sessionId.value = getSessionId()

  beat().catch((error) => console.error('Error publishing presence:', error))
  heartbeat = setInterval(() => {
    beat().catch((error) => console.error('Error publishing presence:', error))
  }, HEARTBEAT_MS)

  handleUnload = () => removePresence(sessionId.value)
  window.addEventListener('beforeunload', handleUnload)

  unsubscribe = subscribeToPresence((records) => {
    everyone.value = records
  })
}

/** Tears everything down and drops this session's record. */
export const stopPresence = async () => {
  if (!started) return
  started = false

  clearInterval(heartbeat)
  heartbeat = null
  unsubscribe?.()
  unsubscribe = null
  if (handleUnload) window.removeEventListener('beforeunload', handleUnload)
  handleUnload = null
  lastActivityWrite = 0

  const id = sessionId.value
  sessionId.value = ''
  everyone.value = []
  if (id) await removePresence(id)
}

export function usePresence() {
  // Everyone but this browser tab. One person with two devices open shows up
  // twice, which is the honest answer — these are live sessions, not people.
  const visitors = computed(() => everyone.value.filter((v) => v.id !== sessionId.value))

  const onlineCount = computed(() => visitors.value.length)

  /** Accounts with at least one live session, for "online now" badges. */
  const onlineUids = computed(
    () => new Set(everyone.value.map((v) => v.uid).filter(Boolean))
  )

  const togglePeoplePanel = () => {
    showPeoplePanel.value = !showPeoplePanel.value
  }

  return {
    sessionId,
    everyone,
    visitors,
    onlineCount,
    onlineUids,
    showPeoplePanel,
    togglePeoplePanel,
    isRailCollapsed,
    toggleRail,
  }
}
