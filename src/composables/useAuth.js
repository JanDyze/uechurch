import { computed, markRaw, ref, triggerRef } from 'vue'
import * as authService from '../api/authService'
import { recordSignIn } from '../api/userAccountsService'
import { getAccountAvatarUrl } from '../utils/memberUtils'

// Global auth state (shared across components)
const user = ref(null)
const isReady = ref(false)

let unsubscribe = null

// Resolves once Firebase has restored (or rejected) the persisted session.
// The router guard awaits this so a refresh doesn't bounce a signed-in user
// to /login before Firebase has caught up.
let resolveReady
const ready = new Promise((resolve) => {
  resolveReady = resolve
})

// Starts the auth listener. Safe to call more than once.
export const initAuth = () => {
  if (unsubscribe) return ready

  unsubscribe = authService.subscribeToAuth((firebaseUser) => {
    // markRaw: the Firebase User is a class instance with internal state that
    // shouldn't be wrapped in a reactive proxy. Mutations are published with
    // triggerRef instead (see updateDisplayName).
    user.value = firebaseUser ? markRaw(firebaseUser) : null

    // Mirror the account into Firestore so the Accounts page has something to
    // list — the client SDK cannot enumerate Firebase users. Deliberately not
    // awaited: a slow or blocked write must never hold up the router guard.
    if (firebaseUser) {
      recordSignIn(firebaseUser).catch((error) =>
        console.error('Error recording sign-in:', error)
      )
    }

    if (!isReady.value) {
      isReady.value = true
      resolveReady()
    }
  })

  return ready
}

export function useAuth() {
  const isAuthenticated = computed(() => !!user.value)

  const displayName = computed(() => {
    if (!user.value) return ''
    return user.value.displayName || user.value.email?.split('@')[0] || 'User'
  })

  const email = computed(() => user.value?.email || '')

  // Google supplies a real profile photo; everyone else gets a generated face
  // seeded by uid, which keeps it the same across devices.
  const avatarUrl = computed(() => getAccountAvatarUrl(user.value))

  // updateProfile mutates the existing User object without firing
  // onAuthStateChanged, so nothing would re-render on its own — publish the
  // change to anything reading `user` by hand.
  const updateDisplayName = async (name) => {
    await authService.updateDisplayName(name)
    triggerRef(user)
  }

  return {
    user,
    isReady,
    isAuthenticated,
    displayName,
    email,
    avatarUrl,
    ready,
    initAuth,
    updateDisplayName,
    login: authService.login,
    loginWithGoogle: authService.loginWithGoogle,
    consumePendingGoogleSignIn: authService.consumePendingGoogleSignIn,
    register: authService.register,
    logout: authService.logout,
    resetPassword: authService.resetPassword,
    getAuthErrorMessage: authService.getAuthErrorMessage,
  }
}
