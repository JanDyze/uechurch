import { ref } from 'vue'
import { useMemberClaims } from './useMemberClaims'
import { useToast } from './useToast'

// Asking to be linked to a member record, from wherever the account is shown.
//
// There are two of those: the dropdown off the avatar on a desktop, and the
// drawer the same avatar opens on a phone. The request used to live in the
// dropdown alone, so on a phone — where most people sign in — there was no way
// to ask at all. The sheet's open state is shared at module level so both
// surfaces open the one sheet Topbar renders, rather than each keeping a copy
// that could disagree about whether a request is in flight.
const showClaimSheet = ref(false)
const submittingClaim = ref(false)

export function useClaimFlow() {
  const toast = useToast()
  const { myClaim, myPendingClaim, submitClaim, withdraw } = useMemberClaims()

  const openClaimSheet = () => {
    showClaimSheet.value = true
  }

  const handleClaimSubmit = async (member) => {
    submittingClaim.value = true
    try {
      await submitClaim(member)
      showClaimSheet.value = false
      toast.success('Request sent. An administrator will review it.')
    } catch (e) {
      console.error('Error requesting member link:', e)
      toast.error('Could not send the request. Please try again.')
    } finally {
      submittingClaim.value = false
    }
  }

  const handleWithdrawClaim = async () => {
    try {
      await withdraw(myPendingClaim.value)
      toast.success('Request withdrawn')
    } catch (e) {
      console.error('Error withdrawing member claim:', e)
      toast.error('Could not withdraw the request.')
    }
  }

  return {
    myClaim,
    myPendingClaim,
    showClaimSheet,
    submittingClaim,
    openClaimSheet,
    handleClaimSubmit,
    handleWithdrawClaim,
  }
}
