<script setup>
import { onMounted, ref } from 'vue'
import { Loader2 } from '../../icons'
import { useAuth } from '../../composables/useAuth'

// The only way into the app. It used to sit next to an email-and-password form
// behind a divider — hence the `dividerPosition` prop that used to be here —
// but with the form gone there is nothing left to divide it from, and this is
// simply the button.
//
// It owns its own look now that the auth layout it used to borrow from has
// been folded into the sign-in screen.

defineProps({
  label: { type: String, default: 'Continue with Google' },
})

const emit = defineEmits(['signed-in', 'error'])

const { loginWithGoogle, consumePendingGoogleSignIn, getAuthErrorMessage } = useAuth()
const busy = ref(false)

// When the popup path is unavailable the sign-in finishes as a full-page
// redirect back to here, so the result has to be collected on mount.
onMounted(async () => {
  try {
    const user = await consumePendingGoogleSignIn()
    if (user) emit('signed-in', user)
  } catch (e) {
    emit('error', getAuthErrorMessage(e))
  }
})

const handleClick = async () => {
  busy.value = true
  try {
    const user = await loginWithGoogle()
    // null means the browser is navigating away to the redirect flow.
    if (user) emit('signed-in', user)
  } catch (e) {
    emit('error', getAuthErrorMessage(e))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button type="button" :disabled="busy" class="google" @click="handleClick">
    <Loader2 v-if="busy" class="h-[18px] w-[18px] animate-spin" />
    <!-- Google's four-colour mark, inlined so it works offline. -->
    <svg v-else class="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3.01h3.88c2.27-2.09 3.58-5.17 3.58-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.26a12 12 0 0 0 0 10.74l4.01-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.63l4.01 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
    {{ busy ? 'Signing in...' : label }}
  </button>
</template>

<style scoped>
/* White in both themes, and no dark variant: the sign-in screen is a
   photograph under a heavy scrim whichever theme is on, so this is always a
   light button on a dark ground — which is the case Google's light treatment
   is for, and the only thing on the screen to press.
   The colour stays theirs; the uppercase weight is the app's, which every
   other button in it speaks in. */
.google {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1.15rem 1rem;
  border-radius: 0.9rem;
  border: none;
  background: #fff;
  color: #3c4043;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  box-shadow: 0 10px 30px -12px rgba(0, 0, 0, 0.65), 0 2px 6px -2px rgba(0, 0, 0, 0.4);
  transition: box-shadow 0.2s, transform 0.15s, background-color 0.2s;
}

.google:hover:not(:disabled) {
  background: #f8f9fa;
  box-shadow: 0 16px 38px -12px rgba(0, 0, 0, 0.7), 0 2px 6px -2px rgba(0, 0, 0, 0.4);
}

.google:active:not(:disabled) {
  transform: scale(0.97);
}

.google:disabled {
  opacity: 0.7;
}

@media (prefers-reduced-motion: reduce) {
  .google {
    transition: background-color 0.2s;
  }

  .google:active:not(:disabled) {
    transform: none;
  }
}
</style>
