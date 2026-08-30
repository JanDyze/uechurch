<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronRight, UserRound } from '../../icons'
import { useAuth } from '../../composables/useAuth'
import { useAvatars } from '../../composables/useAvatars'
import { usePresence } from '../../composables/usePresence'
import { usePermissions } from '../../composables/usePermissions'
import { useUserAccounts } from '../../composables/useUserAccounts'
import { timeAgo } from '../../utils/timeUtils'
import MemberAvatar from '../members/MemberAvatar.vue'

// How many of the recently-active are worth a rail. Past that it stops being a
// glance and starts being the Accounts page, which is one tap away anyway.
const RECENT_LIMIT = 8

const emit = defineEmits(['navigate'])

const router = useRouter()
const { displayName } = useAuth()
const { accountMember, accountAvatarUrl, myMember, myAvatarUrl } = useAvatars()
const { visitors, onlineCount } = usePresence()
const { isAdmin } = usePermissions()
const { recentlyActive } = useUserAccounts()

const recent = computed(() => recentlyActive.value.slice(0, RECENT_LIMIT))

// Presence records predate carrying a uid, so fall back to the session id for
// a stable — if not account-matched — face.
const visitorAccount = (visitor) => ({
  photoURL: visitor.photoURL,
  uid: visitor.uid || visitor.id,
})
const visitorAvatar = (visitor) => accountAvatarUrl(visitorAccount(visitor))
// Null for anyone whose account is not claimed against a member record, which
// is the whole point of the rail — visitors included.
const visitorMember = (visitor) => accountMember(visitorAccount(visitor))

// One row per person, so someone signed in on a phone and a laptop is counted
// once. The device tally only earns a tooltip — the list is about who is here.
const visitorTitle = (visitor) => {
  const name = visitor.name || 'Someone'
  return visitor.sessionCount > 1 ? `${name} · ${visitor.sessionCount} devices` : name
}

const goTo = (path) => {
  emit('navigate')
  router.push(path)
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex-1 overflow-y-auto no-scrollbar px-2 py-3 space-y-5">
      <!-- Active now. You are the first face rather than a section of your own:
           the Topbar avatar already owns identity (name, email, account menu),
           so repeating it here spent the top of the rail saying nothing new.
           Listing yourself instead makes the rows agree with the header tally,
           which counts you, and mirrors the collapsed strip's ringed face. -->
      <section>
        <p
          class="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-600"
        >
          Active now
        </p>

        <ul class="space-y-0.5">
          <li class="flex items-center gap-3 px-2.5 py-2">
            <MemberAvatar
              :member="myMember"
              :src="myAvatarUrl"
              alt=""
              size="h-9 w-9"
              plain-class="ring-2 ring-primary"
            >
              <span
                class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950"
              />
            </MemberAvatar>
            <p class="min-w-0 flex-1 text-sm font-semibold text-gray-900 dark:text-white truncate">
              {{ displayName }}
            </p>
            <span
              class="shrink-0 rounded-full bg-primary/10 dark:bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary dark:text-primary-light"
            >
              You
            </span>
          </li>

          <!-- Rows are a glance, not a target — no hover fill, since there is
               nothing behind them to click. -->
          <li
            v-for="visitor in visitors"
            :key="visitor.id"
            :title="visitorTitle(visitor)"
            class="flex items-center gap-3 px-2.5 py-2"
          >
            <MemberAvatar
              :member="visitorMember(visitor)"
              :src="visitorAvatar(visitor)"
              alt=""
              size="h-9 w-9"
            >
              <span
                class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950"
              />
            </MemberAvatar>
            <p
              class="min-w-0 flex-1 text-sm font-medium text-gray-700 dark:text-slate-200 truncate"
            >
              {{ visitor.name || 'Someone' }}
            </p>
          </li>
        </ul>

        <p
          v-if="!onlineCount"
          class="px-2.5 pt-2 text-xs text-gray-400 dark:text-slate-500 leading-relaxed"
        >
          No one else is online right now.
        </p>
      </section>

      <!-- Recently here -->
      <section v-if="recent.length">
        <p
          class="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-600"
        >
          Recently here
        </p>
        <ul class="space-y-0.5">
          <li
            v-for="account in recent"
            :key="account.uid"
            class="flex items-center gap-3 px-2.5 py-2"
          >
            <MemberAvatar
              :member="accountMember(account)"
              :src="accountAvatarUrl(account)"
              alt=""
              size="h-9 w-9"
              class="opacity-60"
            />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-gray-500 dark:text-slate-400 truncate">
                {{ account.name }}
              </p>
              <p class="text-xs text-gray-400 dark:text-slate-600 truncate">
                {{ timeAgo(account.lastActiveAt) }}
              </p>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <!-- Admins can go from a face to the full register of accounts -->
    <div v-if="isAdmin" class="shrink-0 border-t border-gray-200 dark:border-slate-800 p-2">
      <button
        @click="goTo('/accounts')"
        class="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-left text-gray-500 dark:text-slate-400 hover:text-primary dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
      >
        <UserRound class="h-4 w-4 shrink-0" />
        <span class="flex-1 text-xs font-semibold">All accounts</span>
        <ChevronRight class="h-4 w-4 shrink-0 text-gray-300 dark:text-slate-700" />
      </button>
    </div>
  </div>
</template>
