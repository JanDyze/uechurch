<script setup>
import { onMounted, ref } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import { useAuth } from '../../composables/useAuth'

const props = defineProps({
  label: { type: String, default: 'Continue with Google' },
  // 'top' when Google is the alternative below a form; 'bottom' when Google
  // leads and the form is the alternative. The rule stays the same either way:
  // the divider sits between the two options, never outside them.
  dividerPosition: { type: String, default: 'top' },
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
  <div>
    <!-- Divider -->
    <div v-if="dividerPosition === 'top'" class="flex items-center gap-3 my-6">
      <span class="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
      <span class="text-[9px] font-black uppercase tracking-widest text-gray-300 dark:text-gray-600">
        or
      </span>
      <span class="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
    </div>

    <button
      type="button"
      :disabled="busy"
      class="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl border-2 border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-[10px] font-black uppercase tracking-widest hover:border-gray-200 dark:hover:border-gray-700 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
      @click="handleClick"
    >
      <Loader2 v-if="busy" class="w-4 h-4 animate-spin" />
      <!-- Google's four-colour mark, inlined so it works offline. -->
      <svg v-else class="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
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

    <div v-if="dividerPosition === 'bottom'" class="flex items-center gap-3 my-6">
      <span class="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
      <span class="text-[9px] font-black uppercase tracking-widest text-gray-300 dark:text-gray-600">
        or
      </span>
      <span class="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
    </div>
  </div>
</template>
