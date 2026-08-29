import { computed } from 'vue'
import { useAuth } from './useAuth'
import { useMembers } from './useMembers'
import { memberKey } from '../utils/sgUtils'

/**
 * The member record the signed-in account has been approved to act as, or null
 * when no link has been made. Read-only — linking goes through useMemberClaims.
 */
export function useMyMember() {
  const { user } = useAuth()
  const { members, loading } = useMembers()

  const myMember = computed(() => {
    if (!user.value) return null
    return members.value.find((member) => member.uid === user.value.uid) || null
  })

  const myMemberId = computed(() => (myMember.value ? memberKey(myMember.value) : null))

  const isLinked = computed(() => Boolean(myMember.value))

  // No per-member isMe() helper here on purpose: rendering it per row would
  // mean calling this composable per row, and useMembers() opens a Firestore
  // listener on every call. YouBadge compares member.uid to the auth uid
  // directly instead.
  return { myMember, myMemberId, isLinked, loading }
}
