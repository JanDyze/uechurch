<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  BadgeCheck,
  ChevronRight,
  Info,
  Link2Off,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserRound,
  Users,
  X,
} from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'
import { useUserAccounts } from '../composables/useUserAccounts'
import { useToast } from '../composables/useToast'
import { getAccountAvatarUrl } from '../utils/memberUtils'
import { formatDate, formatDateTime, timeAgo } from '../utils/timeUtils'
import { providerLabel, syncAccountsFromAuth } from '../api/userAccountsService'
import ProviderBadge from '../components/people/ProviderBadge.vue'

const router = useRouter()
const toast = useToast()
const { user } = useAuth()
const { accounts, loading, stats } = useUserAccounts()

// Pulls in accounts that have not opened the app since this page existed —
// the browser can only ever stamp its own.
const syncing = ref(false)

const handleSync = async () => {
  syncing.value = true
  try {
    const { synced } = await syncAccountsFromAuth()
    toast.success(`${synced} account${synced === 1 ? '' : 's'} up to date`)
  } catch (error) {
    console.error('Error syncing accounts:', error)
    toast.error(error.message || 'Could not refresh the account list.')
  } finally {
    syncing.value = false
  }
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'online', label: 'Online' },
  { key: 'google', label: 'Google' },
  { key: 'password', label: 'Email' },
  { key: 'admins', label: 'Admins' },
  { key: 'unlinked', label: 'Not linked' },
]

const search = ref('')
const activeFilter = ref('all')

const matchesFilter = (account) => {
  switch (activeFilter.value) {
    case 'online':
      return account.isOnline
    case 'google':
      return account.providers.includes('google.com')
    case 'password':
      return account.providers.includes('password')
    case 'admins':
      return account.isAdmin
    case 'unlinked':
      return !account.member
    default:
      return true
  }
}

const visibleAccounts = computed(() => {
  const term = search.value.trim().toLowerCase()

  return accounts.value
    .filter(matchesFilter)
    .filter((account) => {
      if (!term) return true
      return [account.name, account.email, account.memberName]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(term))
    })
    // Whoever is here right now comes first; after that, most recently seen.
    .sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1
      return (b.lastActiveAt?.getTime() || 0) - (a.lastActiveAt?.getTime() || 0)
    })
})

const providerSplit = computed(() => {
  const total = stats.value.total || 1
  return [
    { key: 'google.com', count: stats.value.google, share: (stats.value.google / total) * 100 },
    { key: 'password', count: stats.value.password, share: (stats.value.password / total) * 100 },
  ].filter((row) => row.count > 0)
})

const isMe = (account) => account.uid === user.value?.uid

/* ---------------------------------------------------------------- details */
// The list is live, so hold the uid rather than the object — a heartbeat
// landing while the sheet is open would otherwise leave it showing a stale copy.
const selected = ref(null)

const openDetails = (uid) => {
  selected.value = uid
}

const selectedAccount = computed(() =>
  selected.value ? accounts.value.find((a) => a.uid === selected.value) || null : null
)

const openMemberProfile = (account) => {
  const member = account.member
  if (!member) return
  selected.value = null
  router.push(`/members/${member.id || member.firestoreId}`)
}
</script>

<template>
  <div class="h-full overflow-y-auto">
    <!-- Header -->
    <div class="mb-4 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">Accounts</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Everyone who has signed in, how they signed up, and when they were last here
        </p>
      </div>
      <button
        @click="handleSync"
        :disabled="syncing"
        class="shrink-0 flex h-10 items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 text-gray-600 dark:text-gray-300 transition-transform active:scale-95 disabled:opacity-50"
        title="Pull the latest list from Firebase"
      >
        <RefreshCw :class="['h-4 w-4', syncing ? 'animate-spin' : '']" />
        <span class="hidden sm:inline text-sm font-medium">
          {{ syncing ? 'Refreshing...' : 'Refresh' }}
        </span>
      </button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
      <div
        class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3"
      >
        <div class="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
          <Users class="h-3.5 w-3.5" />
          <p class="text-[10px] font-bold uppercase tracking-widest">Accounts</p>
        </div>
        <p class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{{ stats.total }}</p>
      </div>

      <div
        class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3"
      >
        <div class="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
          <span class="h-2 w-2 rounded-full bg-emerald-500" />
          <p class="text-[10px] font-bold uppercase tracking-widest">Online</p>
        </div>
        <p class="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
          {{ stats.online }}
        </p>
      </div>

      <div
        class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3"
      >
        <div class="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
          <BadgeCheck class="h-3.5 w-3.5" />
          <p class="text-[10px] font-bold uppercase tracking-widest">This week</p>
        </div>
        <p class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
          {{ stats.activeThisWeek }}
        </p>
      </div>

      <div
        class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3"
      >
        <div class="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
          <UserCheck class="h-3.5 w-3.5" />
          <p class="text-[10px] font-bold uppercase tracking-widest">Linked</p>
        </div>
        <p class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
          {{ stats.linked }}<span class="text-sm text-gray-400">/{{ stats.total }}</span>
        </p>
      </div>
    </div>

    <!-- How people signed up -->
    <div
      v-if="providerSplit.length"
      class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 mb-3"
    >
      <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        How they signed up
      </p>
      <div class="mt-2 flex h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
        <div
          v-for="row in providerSplit"
          :key="row.key"
          :class="row.key === 'google.com' ? 'bg-gray-400 dark:bg-gray-500' : 'bg-primary'"
          :style="{ width: `${row.share}%` }"
        />
      </div>
      <div class="mt-2.5 flex flex-wrap items-center gap-2">
        <span v-for="row in providerSplit" :key="row.key" class="flex items-center gap-1.5">
          <ProviderBadge :provider="row.key" />
          <span class="text-xs font-semibold text-gray-500 dark:text-gray-400">
            {{ row.count }}
          </span>
        </span>
      </div>
    </div>

    <!-- Search -->
    <div class="relative mb-2">
      <Search
        class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
      />
      <input
        v-model="search"
        type="search"
        placeholder="Search by name or email"
        class="w-full h-11 pl-9 pr-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-1 focus:ring-primary focus:border-primary"
      />
    </div>

    <!-- Filters: a swipeable strip rather than a wrapping block on a phone -->
    <div class="mb-3 overflow-x-auto no-scrollbar">
      <div class="flex w-max min-w-full gap-1.5">
        <button
          v-for="filter in FILTERS"
          :key="filter.key"
          @click="activeFilter = filter.key"
          :class="[
            'h-9 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border',
            activeFilter === filter.key
              ? 'bg-primary text-white border-primary shadow-sm'
              : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700',
          ]"
        >
          {{ filter.label }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-2">
      <div
        v-for="i in 4"
        :key="`skeleton-${i}`"
        class="h-[4.5rem] rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse"
      />
    </div>

    <!-- Nothing recorded yet -->
    <div
      v-else-if="!stats.total"
      class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-10 text-center"
    >
      <UserRound class="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
      <p class="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">No accounts yet</p>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
        Tap Refresh to pull the full list from Firebase. After that, each account keeps
        itself up to date whenever its owner opens the app.
      </p>
    </div>

    <!-- Filtered to nothing -->
    <div
      v-else-if="!visibleAccounts.length"
      class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-10 text-center"
    >
      <Search class="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
      <p class="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">No accounts match</p>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Try a different search or filter.
      </p>
    </div>

    <!-- List -->
    <ul v-else class="space-y-2">
      <li v-for="account in visibleAccounts" :key="account.uid">
        <button
          @click="openDetails(account.uid)"
          class="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-left hover:border-primary/40 transition-colors"
        >
          <div class="relative shrink-0">
            <img
              :src="getAccountAvatarUrl(account)"
              alt=""
              class="h-11 w-11 rounded-full object-cover bg-gray-100 dark:bg-gray-700"
            />
            <span
              v-if="account.isOnline"
              class="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-gray-800"
            />
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {{ account.name }}
              </p>
              <span
                v-if="isMe(account)"
                class="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary dark:text-primary-light"
              >
                You
              </span>
              <ShieldCheck
                v-if="account.isAdmin"
                class="h-3.5 w-3.5 text-amber-500"
                aria-label="Administrator"
              />
              <span
                v-if="account.disabled"
                class="rounded-md bg-red-100 dark:bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400"
              >
                Disabled
              </span>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
              {{ account.email || 'No email on file' }}
            </p>
            <div class="mt-1.5 flex items-center gap-2 flex-wrap">
              <ProviderBadge :provider="account.primaryProvider" short />
              <span
                v-if="account.isOnline"
                class="text-xs font-semibold text-emerald-600 dark:text-emerald-400"
              >
                Active now
              </span>
              <span v-else class="text-xs text-gray-400 dark:text-gray-500">
                {{ account.lastActiveAt ? timeAgo(account.lastActiveAt) : 'Never seen' }}
              </span>
              <span
                v-if="!account.member"
                class="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"
              >
                <Link2Off class="h-3 w-3" />
                Not linked
              </span>
            </div>
          </div>

          <ChevronRight class="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
        </button>
      </li>
    </ul>

    <!-- What this page can and cannot know -->
    <p
      v-if="!loading"
      class="mt-4 mb-2 flex items-start gap-2 text-xs text-gray-400 dark:text-gray-500 leading-relaxed"
    >
      <Info class="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <span>
        Accounts record themselves whenever someone opens the app. Anyone who has not been
        back since this page was added shows up after a Refresh, which reads the list
        straight from Firebase.
      </span>
    </p>

    <!-- Details -->
    <Teleport to="body">
      <Transition name="sheet">
        <div
          v-if="selectedAccount"
          class="fixed inset-0 z-80 flex flex-col justify-end sm:items-center sm:justify-center"
        >
          <div class="absolute inset-0 bg-black/50" @click="selected = null" />

          <div
            class="sheet-panel relative z-10 w-full sm:max-w-md max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border-t sm:border border-gray-200 dark:border-gray-700"
          >
            <div
              class="shrink-0 flex items-start gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-700"
            >
              <div class="relative shrink-0">
                <img
                  :src="getAccountAvatarUrl(selectedAccount)"
                  alt=""
                  class="h-12 w-12 rounded-full object-cover bg-gray-100 dark:bg-gray-700"
                />
                <span
                  v-if="selectedAccount.isOnline"
                  class="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-gray-800"
                />
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="text-base font-semibold text-gray-900 dark:text-white truncate">
                  {{ selectedAccount.name }}
                </h3>
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {{ selectedAccount.email || 'No email on file' }}
                </p>
              </div>
              <button
                @click="selected = null"
                class="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Close"
              >
                <X class="h-5 w-5" />
              </button>
            </div>

            <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <!-- Badges -->
              <div class="flex flex-wrap items-center gap-2">
                <ProviderBadge
                  v-for="provider in selectedAccount.providers"
                  :key="provider"
                  :provider="provider"
                />
                <span
                  v-if="selectedAccount.isAdmin"
                  class="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-500/15 px-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400"
                >
                  <ShieldCheck class="h-3.5 w-3.5" />
                  Administrator
                </span>
                <span
                  v-if="selectedAccount.emailVerified"
                  class="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                >
                  <BadgeCheck class="h-3.5 w-3.5" />
                  Email verified
                </span>
                <span
                  v-if="selectedAccount.disabled"
                  class="inline-flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-500/15 px-2 py-1 text-xs font-semibold text-red-600 dark:text-red-400"
                >
                  Disabled
                </span>
              </div>

              <!-- Facts -->
              <dl class="divide-y divide-gray-100 dark:divide-gray-700">
                <div class="flex items-baseline justify-between gap-4 py-2.5">
                  <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">Signed up with</dt>
                  <dd class="text-sm text-gray-900 dark:text-white text-right">
                    {{ providerLabel(selectedAccount.primaryProvider) }}
                  </dd>
                </div>
                <div class="flex items-baseline justify-between gap-4 py-2.5">
                  <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">Joined</dt>
                  <dd class="text-sm text-gray-900 dark:text-white text-right">
                    {{ formatDate(selectedAccount.createdAt) }}
                  </dd>
                </div>
                <div class="flex items-baseline justify-between gap-4 py-2.5">
                  <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">Last sign-in</dt>
                  <dd class="text-sm text-gray-900 dark:text-white text-right">
                    {{ formatDateTime(selectedAccount.lastSignInAt) }}
                  </dd>
                </div>
                <div class="flex items-baseline justify-between gap-4 py-2.5">
                  <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">Last active</dt>
                  <dd
                    :class="[
                      'text-sm text-right',
                      selectedAccount.isOnline
                        ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                        : 'text-gray-900 dark:text-white',
                    ]"
                  >
                    {{ selectedAccount.isOnline ? 'Active now' : timeAgo(selectedAccount.lastActiveAt) || '—' }}
                  </dd>
                </div>
                <div class="flex items-baseline justify-between gap-4 py-2.5">
                  <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">User ID</dt>
                  <dd class="text-xs font-mono text-gray-400 dark:text-gray-500 text-right break-all">
                    {{ selectedAccount.uid }}
                  </dd>
                </div>
              </dl>

              <!-- Which member record this account acts as -->
              <button
                v-if="selectedAccount.member"
                @click="openMemberProfile(selectedAccount)"
                class="w-full flex items-center gap-2.5 p-3 rounded-xl bg-primary/5 dark:bg-primary/10 text-left hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors"
              >
                <UserCheck class="h-4 w-4 shrink-0 text-primary dark:text-primary-light" />
                <span class="flex-1 min-w-0">
                  <span
                    class="block text-[10px] font-bold uppercase tracking-widest text-primary dark:text-primary-light"
                  >
                    Linked member
                  </span>
                  <span class="block text-sm font-medium text-gray-900 dark:text-white truncate">
                    {{ selectedAccount.memberName }}
                  </span>
                </span>
                <ChevronRight class="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
              </button>

              <div
                v-else
                class="flex items-start gap-2.5 p-3 rounded-xl border border-dashed border-gray-200 dark:border-gray-700"
              >
                <Link2Off class="h-4 w-4 shrink-0 mt-0.5 text-gray-400" />
                <div class="min-w-0">
                  <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Not linked to a member
                  </p>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    This account has no member record yet, so it only holds the permissions
                    every signed-in account gets. Approve a request under Settings &rsaquo;
                    Accounts.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.25s ease;
}

.sheet-enter-active .sheet-panel,
.sheet-leave-active .sheet-panel {
  transition: transform 0.25s ease;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .sheet-panel,
.sheet-leave-to .sheet-panel {
  transform: translateY(100%);
}

@media (min-width: 640px) {
  .sheet-enter-from .sheet-panel,
  .sheet-leave-to .sheet-panel {
    transform: scale(0.96);
  }
}
</style>
