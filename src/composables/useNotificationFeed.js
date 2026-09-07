import { computed, onMounted, onUnmounted, ref } from 'vue'
import { subscribeToNotifications } from '../api/notifyService'
import { usePermissions } from './usePermissions'
import { canReceive } from '../../lib/notifications'

// One feed, shared. It used to live inside Topbar.vue, which was fine while the
// bell was the only thing reading it; the people drawer now shows the same
// history on a phone, and two copies of a list with an unread count is the kind
// of duplication that drifts.
const notifications = ref([])
const lastSeenNotif = ref(0)
let unsubscribe = null
let subscribers = 0

const SEEN_KEY = 'uec_notif_last_seen'

try {
  lastSeenNotif.value = Number(localStorage.getItem(SEEN_KEY) || 0)
} catch {
  // Private mode: everything reads as unseen, which is the harmless direction.
}

export function useNotificationFeed() {
  const { isAdmin, capabilities } = usePermissions()

  onMounted(() => {
    subscribers += 1
    if (unsubscribe) return
    unsubscribe = subscribeToNotifications((list) => (notifications.value = list))
  })

  onUnmounted(() => {
    subscribers -= 1
    if (subscribers <= 0 && unsubscribe) {
      unsubscribe()
      unsubscribe = null
      subscribers = 0
    }
  })

  /**
   * The history is one collection everyone can read, so the panel has to apply
   * the same gate api/notify.js applied when it chose who to push to —
   * otherwise a prayer concern would be readable here by someone who cannot
   * open the page it links to. Entries from before kinds existed carry none
   * and stay visible.
   */
  const visibleNotifications = computed(() =>
    notifications.value.filter((n) =>
      canReceive(n.kind, { isAdmin: isAdmin.value, capabilities: capabilities.value })
    )
  )

  const unreadCount = computed(
    () =>
      visibleNotifications.value.filter(
        (n) => n.sentAt && n.sentAt.toMillis() > lastSeenNotif.value
      ).length
  )

  /** Called when the history is actually shown, wherever it is shown from. */
  const markSeen = () => {
    lastSeenNotif.value = Date.now()
    try {
      localStorage.setItem(SEEN_KEY, String(lastSeenNotif.value))
    } catch {
      // The badge simply comes back next launch.
    }
  }

  return { notifications, visibleNotifications, unreadCount, markSeen }
}

/** 'just now', '5m ago', '3d ago', then a date. */
export const timeAgo = (ts) => {
  if (!ts) return 'just now'
  const s = Math.floor((Date.now() - ts.toMillis()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return ts.toDate().toLocaleDateString()
}
