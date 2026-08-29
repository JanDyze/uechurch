import { computed, ref, onMounted, onUnmounted } from 'vue'
import {
  subscribeToMemberClaims,
  requestMemberClaim,
  withdrawMemberClaim,
  approveMemberClaim,
  rejectMemberClaim,
  unlinkMember,
} from '../api/memberClaimsService'
import { getFullName } from '../utils/memberUtils'
import { useAuth } from './useAuth'

// Shared listener: the topbar, the claim sheet and the Settings queue all read
// the same list.
const claims = ref([])
const loading = ref(true)
let unsubscribe = null
let subscribers = 0

export function useMemberClaims() {
  const { user } = useAuth()

  onMounted(() => {
    subscribers += 1
    if (unsubscribe) return
    unsubscribe = subscribeToMemberClaims((data) => {
      claims.value = data
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

  const pendingClaims = computed(() => claims.value.filter((c) => c.status === 'pending'))

  const reviewedClaims = computed(() => claims.value.filter((c) => c.status !== 'pending'))

  /** The signed-in account's own claim, whatever state it is in. */
  const myClaim = computed(() => {
    if (!user.value) return null
    return claims.value.find((c) => c.uid === user.value.uid) || null
  })

  const myPendingClaim = computed(() =>
    myClaim.value?.status === 'pending' ? myClaim.value : null
  )

  const submitClaim = (member) =>
    requestMemberClaim(user.value, member, getFullName(member))

  const withdraw = (claim) => withdrawMemberClaim(claim.firestoreId)

  const approve = (claim, member) => approveMemberClaim(claim, member, user.value)

  const reject = (claim, note) => rejectMemberClaim(claim, user.value, note)

  const unlink = (member) => unlinkMember(member)

  return {
    claims,
    loading,
    pendingClaims,
    reviewedClaims,
    myClaim,
    myPendingClaim,
    submitClaim,
    withdraw,
    approve,
    reject,
    unlink,
  }
}
