import { computed } from 'vue'
import { useAuth } from './useAuth'
import { usePermissions } from './usePermissions'
import { getAccountAvatarUrl } from '../utils/memberUtils'

/**
 * One face per person, wherever they appear.
 *
 * An account can carry two pictures: whatever the provider handed us at
 * sign-in (a Google thumbnail, or nothing at all for an email/password
 * account) and the photo on the member record it was approved to act as. The
 * member photo is the one the church actually maintains, so it wins — without
 * this, updating someone's member photo left the topbar, the people rail and
 * the accounts register still showing the stale sign-in picture.
 *
 * Resolution is one-directional and read-only: nothing is written back to the
 * Firebase profile, so the member record stays the single place a face is
 * edited.
 */
export function useAvatars() {
  const { user } = useAuth()
  // Module-level and app-wide, started once by initPermissions, so this joins
  // against a list that is already in memory rather than opening a listener.
  const { members } = usePermissions()

  const memberByUid = computed(() => {
    const map = new Map()
    members.value.forEach((member) => {
      if (member.uid) map.set(member.uid, member)
    })
    return map
  })

  /**
   * The member record an account was approved to act as, or null for anyone
   * signed in without one — a visitor, or a claim still waiting on approval.
   * This is also what decides whether a face is framed, so it has to be the
   * record itself rather than just the photo off it.
   *
   * Takes anything carrying a uid — a Firebase user, an account mirror, a
   * presence record. Presence rows that predate the uid field fall back to a
   * session id, which simply never matches a member and so lands on the
   * provider photo or the generated face, exactly as before.
   */
  const accountMember = (account) => {
    const uid = account?.uid || account?.id
    return (uid && memberByUid.value.get(uid)) || null
  }

  const accountAvatarUrl = (account) =>
    accountMember(account)?.image || getAccountAvatarUrl(account)

  /** The signed-in account's own member record, and own face. */
  const myMember = computed(() => accountMember(user.value))
  const myAvatarUrl = computed(() => accountAvatarUrl(user.value))

  return { accountMember, accountAvatarUrl, myMember, myAvatarUrl }
}
