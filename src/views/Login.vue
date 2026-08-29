<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Eye, EyeOff, Loader2 } from 'lucide-vue-next'
import AuthLayout from '../layouts/AuthLayout.vue'
import GoogleSignInButton from '../components/auth/GoogleSignInButton.vue'
import { useAuth } from '../composables/useAuth'
import { useToast } from '../composables/useToast'

const route = useRoute()
const router = useRouter()
const { login, resetPassword, getAuthErrorMessage } = useAuth()
const toast = useToast()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const submitting = ref(false)
const sendingReset = ref(false)
const error = ref('')

const handleSubmit = async () => {
  error.value = ''

  if (!email.value.trim() || !password.value) {
    error.value = 'Please enter your email and password.'
    return
  }

  submitting.value = true
  try {
    await login(email.value, password.value)
    toast.success('Welcome back!')
    goAfterSignIn()
  } catch (e) {
    error.value = getAuthErrorMessage(e)
  } finally {
    submitting.value = false
  }
}

const goAfterSignIn = () => {
  const redirect = route.query.redirect
  router.replace(typeof redirect === 'string' ? redirect : '/dashboard')
}

const handleGoogleSignedIn = (user) => {
  error.value = ''
  toast.success(`Welcome, ${user.displayName || user.email}!`)
  goAfterSignIn()
}

const handleForgotPassword = async () => {
  if (!email.value.trim()) {
    error.value = 'Enter your email above first, then tap "Forgot password?".'
    return
  }

  sendingReset.value = true
  try {
    await resetPassword(email.value)
    toast.success(`Password reset link sent to ${email.value.trim()}`)
  } catch (e) {
    error.value = getAuthErrorMessage(e)
  } finally {
    sendingReset.value = false
  }
}
</script>

<template>
  <AuthLayout title="Sign in" subtitle="Welcome back">
    <GoogleSignInButton
      divider-position="bottom"
      @signed-in="handleGoogleSignedIn"
      @error="error = $event"
    />

    <form novalidate class="space-y-5" @submit.prevent="handleSubmit">
      <!-- Error banner -->
      <p
        v-if="error"
        role="alert"
        class="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border-2 border-red-100 dark:border-red-500/20 text-[11px] font-bold text-red-600 dark:text-red-400"
      >
        {{ error }}
      </p>

      <div>
        <label
          for="login-email"
          class="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2"
        >
          Email address
        </label>
        <input
          id="login-email"
          v-model="email"
          type="email"
          autocomplete="email"
          autofocus
          placeholder="you@example.com"
          class="w-full px-4 py-3 text-sm rounded-xl border-2 border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:outline-none focus:border-primary dark:focus:border-primary-light transition-colors"
        />
      </div>

      <div>
        <div class="flex items-center justify-between mb-2">
          <label
            for="login-password"
            class="text-[9px] font-black uppercase tracking-widest text-gray-400"
          >
            Password
          </label>
          <button
            type="button"
            :disabled="sendingReset"
            class="text-[9px] font-black uppercase tracking-widest text-primary dark:text-primary-light hover:underline disabled:opacity-50"
            @click="handleForgotPassword"
          >
            {{ sendingReset ? 'Sending...' : 'Forgot password?' }}
          </button>
        </div>
        <div class="relative">
          <input
            id="login-password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            placeholder="••••••••"
            class="w-full px-4 py-3 pr-12 text-sm rounded-xl border-2 border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:outline-none focus:border-primary dark:focus:border-primary-light transition-colors"
          />
          <button
            type="button"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
            class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-primary dark:hover:text-primary-light transition-colors"
            @click="showPassword = !showPassword"
          >
            <EyeOff v-if="showPassword" class="w-4 h-4" />
            <Eye v-else class="w-4 h-4" />
          </button>
        </div>
      </div>

      <button
        type="submit"
        :disabled="submitting"
        class="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
      >
        <Loader2 v-if="submitting" class="w-4 h-4 animate-spin" />
        {{ submitting ? 'Signing in...' : 'Sign in' }}
      </button>
    </form>

    <p class="mt-8 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">
      No account yet?
      <RouterLink
        to="/register"
        class="text-primary dark:text-primary-light hover:underline ml-1"
      >
        Create one
      </RouterLink>
    </p>
  </AuthLayout>
</template>
