<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Eye, EyeOff, Loader2 } from '../icons'
import AuthLayout from '../layouts/AuthLayout.vue'
import GoogleSignInButton from '../components/auth/GoogleSignInButton.vue'
import { useAuth } from '../composables/useAuth'
import { useToast } from '../composables/useToast'

const router = useRouter()
const { register, getAuthErrorMessage } = useAuth()
const toast = useToast()

const fullName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const submitting = ref(false)
const error = ref('')

const handleGoogleSignedIn = (user) => {
  error.value = ''
  toast.success(`Welcome, ${user.displayName || user.email}!`)
  router.replace('/dashboard')
}

const validate = () => {
  if (!fullName.value.trim()) return 'Please enter your full name.'
  if (!email.value.trim()) return 'Please enter your email address.'
  if (password.value.length < 6) return 'Password must be at least 6 characters.'
  if (password.value !== confirmPassword.value) return 'Passwords do not match.'
  return ''
}

const handleSubmit = async () => {
  error.value = validate()
  if (error.value) return

  submitting.value = true
  try {
    await register(email.value, password.value, fullName.value)
    // Firebase signs the new user in automatically, so the guard lets us through.
    toast.success('Account created. Welcome!')
    router.replace('/dashboard')
  } catch (e) {
    error.value = getAuthErrorMessage(e)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthLayout title="Create account" subtitle="Get started">
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
          for="register-name"
          class="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2"
        >
          Full name
        </label>
        <input
          id="register-name"
          v-model="fullName"
          type="text"
          autocomplete="name"
          autofocus
          placeholder="Juan dela Cruz"
          class="w-full px-4 py-3 text-sm rounded-xl border-2 border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:outline-none focus:border-primary dark:focus:border-primary-light transition-colors"
        />
      </div>

      <div>
        <label
          for="register-email"
          class="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2"
        >
          Email address
        </label>
        <input
          id="register-email"
          v-model="email"
          type="email"
          autocomplete="email"
          placeholder="you@example.com"
          class="w-full px-4 py-3 text-sm rounded-xl border-2 border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:outline-none focus:border-primary dark:focus:border-primary-light transition-colors"
        />
      </div>

      <div>
        <label
          for="register-password"
          class="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2"
        >
          Password
        </label>
        <div class="relative">
          <input
            id="register-password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            placeholder="At least 6 characters"
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

      <div>
        <label
          for="register-confirm"
          class="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2"
        >
          Confirm password
        </label>
        <input
          id="register-confirm"
          v-model="confirmPassword"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="new-password"
          placeholder="Re-enter your password"
          class="w-full px-4 py-3 text-sm rounded-xl border-2 border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:outline-none focus:border-primary dark:focus:border-primary-light transition-colors"
        />
      </div>

      <button
        type="submit"
        :disabled="submitting"
        class="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
      >
        <Loader2 v-if="submitting" class="w-4 h-4 animate-spin" />
        {{ submitting ? 'Creating account...' : 'Create account' }}
      </button>
    </form>

    <GoogleSignInButton
      label="Sign up with Google"
      @signed-in="handleGoogleSignedIn"
      @error="error = $event"
    />

    <p class="mt-8 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">
      Already registered?
      <RouterLink
        to="/login"
        class="text-primary dark:text-primary-light hover:underline ml-1"
      >
        Sign in
      </RouterLink>
    </p>
  </AuthLayout>
</template>
