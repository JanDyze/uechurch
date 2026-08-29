import { computed, onMounted, onUnmounted, ref } from 'vue'
import { subscribeToUserAccounts } from '../api/userAccountsService'
import { usePermissions } from './usePermissions'
import { usePresence } from './usePresence'
import { getFullName } from '../utils/memberUtils'

// Shared across callers — the Accounts page and the people rail both read the
// same list, and there is no reason for each to open its own listener.
const accounts = ref([])
const loading = ref(true)
let unsubscribe = null
let subscribers = 0

const DAY_MS = 24 * 60 * 60 * 1000

export function useUserAccounts() {
  // Both already loaded app-wide by initPermissions, so joining against them
  // costs nothing extra.
  const { admins, members } = usePermissions()
  const { onlineUids } = usePresence()

  onMounted(() => {
    subscribers += 1
    if (unsubscribe) return
    unsubscribe = subscribeToUserAccounts((data) => {
      accounts.value = data
      loading.value = false
    })
  })

  onUnmounted(() => {
    subscribers -= 1
    if (subscribers <= 0 && unsubscribe) {
      unsubscribe()
      unsubscribe = null
      subscribers = 0
    }
  })

  const adminUids = computed(() => new Set(admins.value.map((a) => a.uid)))

  const membersByUid = computed(() => {
    const map = new Map()
    members.value.forEach((member) => {
      if (member.uid) map.set(member.uid, member)
    })
    return map
  })

  /**
   * Each account joined to what the rest of the app knows about it: whether
   * it is online, whether it is an administrator, and which member record it
   * was approved to act as.
   */
  const enriched = computed(() =>
    accounts.value.map((account) => {
      const member = membersByUid.value.get(account.uid) || null
      return {
        ...account,
        isOnline: onlineUids.value.has(account.uid),
        isAdmin: adminUids.value.has(account.uid),
        member,
        memberName: member ? getFullName(member) : '',
        // A Google account without a name of its own still has an email.
        name: account.displayName || account.email?.split('@')[0] || 'Unnamed account',
      }
    })
  )

  const stats = computed(() => {
    const now = Date.now()
    const list = enriched.value
    const byProvider = {}

    list.forEach((account) => {
      byProvider[account.primaryProvider] = (byProvider[account.primaryProvider] || 0) + 1
    })

    const within = (date, days) => date && now - date.getTime() < days * DAY_MS

    return {
      total: list.length,
      online: list.filter((a) => a.isOnline).length,
      activeThisWeek: list.filter((a) => a.isOnline || within(a.lastActiveAt, 7)).length,
      newThisMonth: list.filter((a) => within(a.createdAt, 30)).length,
      linked: list.filter((a) => a.member).length,
      admins: list.filter((a) => a.isAdmin).length,
      google: byProvider['google.com'] || 0,
      password: byProvider.password || 0,
      byProvider,
    }
  })

  /** Signed in at some point in the last week but not online right now. */
  const recentlyActive = computed(() =>
    enriched.value
      .filter((a) => !a.isOnline && a.lastActiveAt && Date.now() - a.lastActiveAt.getTime() < 7 * DAY_MS)
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
  )

  return { accounts: enriched, loading, stats, recentlyActive }
}
