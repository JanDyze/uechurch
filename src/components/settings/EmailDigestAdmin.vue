<script setup>
import { computed, ref } from 'vue'
import {
  Mail,
  Send,
  Loader2,
  FileText,
  Info,
  CheckCircle2,
  AlertCircle,
  Clock3,
} from '../../icons'
import { useAuth } from '../../composables/useAuth'
import { useAdmins } from '../../composables/useAdmins'
import { useToast } from '../../composables/useToast'
import { useEmailDigest, useEmailSending } from '../../composables/useEmailDigest'
import { timeAgo } from '../../utils/timeUtils'
import ConfirmationModal from '../common/ConfirmationModal.vue'

const toast = useToast()
const { email: myEmail, isAuthenticated } = useAuth()
const { isAdmin } = useAdmins()
const { prefs, loading, saving, isEnabled, kinds, toggleEnabled, setKind } = useEmailDigest()
const { busy, log, logLoading, logError, send, sendActivity } = useEmailSending()

const ACTIVITY_RANGES = [
  { key: 'month', label: 'This month' },
  { key: 'quarter', label: 'Last 3 months' },
  { key: 'all', label: 'Everything' },
]
const activityRange = ref('month')

/* ------------------------------------------------ my own subscription */

const handleToggle = async () => {
  try {
    await toggleEnabled()
    toast.success(isEnabled.value ? 'Email digests are on' : 'Email digests are off')
  } catch (error) {
    console.error('Error saving email preferences:', error)
    toast.error('Could not save that. Please try again.')
  }
}

const handleKindToggle = async (key) => {
  try {
    await setKind(key, !prefs.value[key])
  } catch (error) {
    console.error('Error saving email preferences:', error)
    toast.error('Could not save that. Please try again.')
  }
}

/* ------------------------------------------------------- sending now */

// Sending mails the whole congregation and cannot be recalled, so every button
// asks the server what it would actually do first, then puts the real numbers
// in front of the administrator before anything leaves.
const showConfirm = ref(false)
const pending = ref(null)

const label = (kind) =>
  kind === 'activity'
    ? 'activity report'
    : kinds.find((k) => k.key === kind)?.label || kind

// Held separately from `pending` so the wording stays put while the modal
// animates out, instead of flashing an empty title on the way.
const confirmTitle = computed(() =>
  pending.value ? `Send the ${label(pending.value.kind)}?` : 'Send this email?'
)

const confirmMessage = computed(() => {
  const p = pending.value
  if (!p) return ''
  if (p.kind === 'activity') {
    return `Send the ${ACTIVITY_RANGES.find((r) => r.key === activityRange.value)?.label.toLowerCase()} activity report to ${myEmail.value}?`
  }
  const people = p.recipients === 1 ? '1 person' : `${p.recipients} people`
  return `"${p.subject}" covers ${p.events} ${p.events === 1 ? 'entry' : 'entries'} and will go to ${people}. Send it now?`
})

const prepare = async (kind) => {
  try {
    const preview =
      kind === 'activity'
        ? await sendActivity(activityRange.value, { preview: true })
        : await send(kind, { preview: true })

    if (preview.skipped) {
      toast.info(preview.reason || 'There is nothing to send.')
      return
    }

    pending.value = { kind, ...preview }
    showConfirm.value = true
  } catch (error) {
    console.error('Error preparing digest:', error)
    toast.error(error.message || 'Could not reach the mail service.')
  }
}

const confirmSend = async () => {
  const kind = pending.value?.kind
  if (!kind) return
  try {
    const result =
      kind === 'activity' ? await sendActivity(activityRange.value) : await send(kind)

    if (result.skipped) {
      toast.info(result.reason || 'Nothing was sent.')
    } else if (result.failed) {
      toast.error(`Sent to ${result.sent}, but ${result.failed} failed.`)
    } else {
      toast.success(
        kind === 'activity'
          ? `Activity report sent to ${result.to}`
          : `Sent to ${result.sent} ${result.sent === 1 ? 'person' : 'people'}`
      )
    }
  } catch (error) {
    console.error('Error sending digest:', error)
    toast.error(error.message || 'Could not send. Please try again.')
  }
}

const kindLabel = (kind) =>
  kind === 'activity' ? 'Activity report' : kinds.find((k) => k.key === kind)?.label || kind
</script>

<template>
  <div class="space-y-4">
    <!-- My subscription — everyone with an account sees this -->
    <section
      class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
    >
      <div class="flex items-start gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-700">
        <div class="p-2 rounded-lg bg-primary/10 shrink-0">
          <Mail class="h-5 w-5 text-primary dark:text-primary-light" />
        </div>
        <div class="min-w-0">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Email digests</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            A summary of what is on, sent to
            <span class="font-medium text-gray-700 dark:text-gray-300">{{ myEmail || 'your account' }}</span>
          </p>
        </div>
      </div>

      <p
        v-if="!isAuthenticated"
        class="px-4 py-6 text-sm text-center text-gray-500 dark:text-gray-400"
      >
        Sign in to manage your email digests.
      </p>

      <div v-else-if="loading" class="p-4 space-y-3">
        <div
          v-for="i in 3"
          :key="`digest-skeleton-${i}`"
          class="h-14 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse"
        ></div>
      </div>

      <template v-else>
        <!-- Master switch -->
        <div class="flex items-center gap-3 px-4 py-4">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              Send me email digests
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              On by default. Turn this off to stop receiving them.
            </p>
          </div>
          <button
            @click="handleToggle"
            :disabled="saving"
            :class="[
              'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
              isEnabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600',
            ]"
            role="switch"
            :aria-checked="isEnabled"
            aria-label="Send me email digests"
          >
            <span
              :class="[
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                isEnabled ? 'translate-x-6' : 'translate-x-1',
              ]"
            ></span>
          </button>
        </div>

        <!-- Which of the three, once the master switch is on -->
        <ul
          v-if="isEnabled"
          class="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700"
        >
          <li v-for="kind in kinds" :key="kind.key" class="flex items-center gap-3 px-4 py-3">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ kind.label }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {{ kind.schedule }} &middot; {{ kind.description }}
              </p>
            </div>
            <button
              @click="handleKindToggle(kind.key)"
              :disabled="saving"
              :class="[
                'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
                prefs[kind.key] ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600',
              ]"
              role="switch"
              :aria-checked="Boolean(prefs[kind.key])"
              :aria-label="`Receive the ${kind.label} digest`"
            >
              <span
                :class="[
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  prefs[kind.key] ? 'translate-x-6' : 'translate-x-1',
                ]"
              ></span>
            </button>
          </li>
        </ul>
      </template>
    </section>

    <!-- Administrator controls -->
    <section
      v-if="isAdmin"
      class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
    >
      <div class="flex items-start gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-700">
        <div class="p-2 rounded-lg bg-primary/10 shrink-0">
          <Send class="h-5 w-5 text-primary dark:text-primary-light" />
        </div>
        <div class="min-w-0">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Send a digest now</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Goes to everyone who switched that digest on, without waiting for its schedule
          </p>
        </div>
      </div>

      <div
        class="flex items-start gap-2 mx-4 mt-4 rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3 text-xs text-gray-600 dark:text-gray-300"
      >
        <Info class="h-4 w-4 shrink-0 text-gray-400 mt-0.5" />
        <p>
          You will see the subject line and how many people it reaches before anything
          is sent. Digests are skipped automatically when the calendar has nothing on
          it, so an empty week never becomes an empty email.
        </p>
      </div>

      <ul class="p-4 space-y-2">
        <li
          v-for="kind in kinds"
          :key="`send-${kind.key}`"
          class="flex items-center gap-3 rounded-lg border border-gray-100 dark:border-gray-700 p-3"
        >
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ kind.label }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ kind.schedule }}</p>
          </div>
          <button
            @click="prepare(kind.key)"
            :disabled="Boolean(busy)"
            class="shrink-0 flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-white shadow-sm transition-transform active:scale-95 disabled:opacity-50"
          >
            <Loader2 v-if="busy === kind.key" class="h-4 w-4 animate-spin" />
            <Send v-else class="h-4 w-4" />
            <span class="text-sm font-medium">Send</span>
          </button>
        </li>
      </ul>
    </section>

    <!-- The admin's own full report -->
    <section
      v-if="isAdmin"
      class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
    >
      <div class="flex items-start gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-700">
        <div class="p-2 rounded-lg bg-primary/10 shrink-0">
          <FileText class="h-5 w-5 text-primary dark:text-primary-light" />
        </div>
        <div class="min-w-0">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Activity report</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Everything across the app — attendance, minutes, prayer concerns, small
            groups, the ledger — emailed to you alone
          </p>
        </div>
      </div>

      <div class="p-4 space-y-3">
        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Period
          </label>
          <div class="flex gap-1">
            <button
              v-for="range in ACTIVITY_RANGES"
              :key="range.key"
              @click="activityRange = range.key"
              :class="[
                'h-11 flex-1 rounded-lg text-xs font-medium transition-colors',
                activityRange === range.key
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
              ]"
            >
              {{ range.label }}
            </button>
          </div>
        </div>

        <button
          @click="prepare('activity')"
          :disabled="Boolean(busy)"
          class="w-full h-11 flex items-center justify-center gap-2 rounded-lg bg-primary text-white text-sm font-semibold shadow-sm transition-transform active:scale-95 disabled:opacity-50"
        >
          <Loader2 v-if="busy === 'activity'" class="h-4 w-4 animate-spin" />
          <Mail v-else class="h-4 w-4" />
          Email the report to me
        </button>
        <p class="text-xs text-gray-400 dark:text-gray-500 text-center">
          Sent to {{ myEmail || 'your account' }}
        </p>
      </div>
    </section>

    <!-- What has gone out -->
    <section
      v-if="isAdmin"
      class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
    >
      <div class="flex items-start gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-700">
        <div class="p-2 rounded-lg bg-primary/10 shrink-0">
          <Clock3 class="h-5 w-5 text-primary dark:text-primary-light" />
        </div>
        <div class="min-w-0">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Recent sends</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Scheduled and manual, newest first
          </p>
        </div>
      </div>

      <div v-if="logLoading" class="p-4 space-y-3">
        <div
          v-for="i in 2"
          :key="`log-skeleton-${i}`"
          class="h-12 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse"
        ></div>
      </div>

      <p
        v-else-if="logError"
        class="px-4 py-6 text-sm text-center text-amber-600 dark:text-amber-400"
      >
        {{ logError }}
      </p>

      <p v-else-if="!log.length" class="px-4 py-8 text-sm text-center text-gray-500 dark:text-gray-400">
        No email has been sent yet.
      </p>

      <ul v-else class="divide-y divide-gray-100 dark:divide-gray-700">
        <li v-for="entry in log" :key="entry.id" class="flex items-start gap-3 px-4 py-3">
          <AlertCircle v-if="entry.failed" class="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
          <CheckCircle2 v-else class="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
              {{ entry.subject || kindLabel(entry.kind) }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {{ kindLabel(entry.kind) }} &middot;
              {{ entry.sent }} sent<span v-if="entry.failed">, {{ entry.failed }} failed</span>
              &middot; {{ entry.trigger === 'cron' ? 'scheduled' : 'manual' }}
            </p>
          </div>
          <span class="shrink-0 text-xs text-gray-400 dark:text-gray-500">
            {{ timeAgo(entry.sentAt) }}
          </span>
        </li>
      </ul>
    </section>

    <ConfirmationModal
      :show="showConfirm"
      :title="confirmTitle"
      :message="confirmMessage"
      confirm-text="Send"
      cancel-text="Cancel"
      @update:show="showConfirm = $event"
      @confirm="confirmSend"
      @cancel="pending = null"
    />
  </div>
</template>
