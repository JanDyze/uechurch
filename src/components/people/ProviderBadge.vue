<script setup>
import { computed } from 'vue'
import { KeyRound } from 'lucide-vue-next'
import { providerLabel, providerShortLabel } from '../../api/userAccountsService'

// How an account was created: tapped "Continue with Google", or typed an email
// and password into the register form.
const props = defineProps({
  provider: { type: String, required: true },
  /** Long labels read better in the details sheet, short ones in a list row. */
  short: { type: Boolean, default: false },
})

const isGoogle = computed(() => props.provider === 'google.com')
const label = computed(() =>
  props.short ? providerShortLabel(props.provider) : providerLabel(props.provider)
)
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold whitespace-nowrap',
      isGoogle
        ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
        : 'bg-primary/10 text-primary dark:text-primary-light',
    ]"
  >
    <!-- Google's four-colour mark, inlined so it works offline. -->
    <svg v-if="isGoogle" class="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.14 6.16-4.14Z"
      />
    </svg>
    <KeyRound v-else class="h-3.5 w-3.5 shrink-0" />
    {{ label }}
  </span>
</template>
