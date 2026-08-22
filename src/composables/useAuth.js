import { computed, markRaw, ref, triggerRef } from 'vue'
import * as authService from '../api/authService'

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

  // Avatar seed keeps the same face for the same account across devices
  const avatarUrl = computed(() => {
    const seed = encodeURIComponent(user.value?.uid || 'UEC')
    return `https://api.dicebear.com/9.x/dylan/svg?seed=${seed}`
  })

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
    register: authService.register,
    logout: authService.logout,
    resetPassword: authService.resetPassword,
    getAuthErrorMessage: authService.getAuthErrorMessage,
  }
}
