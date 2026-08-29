<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronRight, UserRound } from 'lucide-vue-next'
import { useAuth } from '../../composables/useAuth'
import { usePresence } from '../../composables/usePresence'
import { usePermissions } from '../../composables/usePermissions'
import { useUserAccounts } from '../../composables/useUserAccounts'
import { getAccountAvatarUrl } from '../../utils/memberUtils'
import { timeAgo } from '../../utils/timeUtils'

// How many of the recently-active are worth a rail. Past that it stops being a
// glance and starts being the Accounts page, which is one tap away anyway.
const RECENT_LIMIT = 8

const emit = defineEmits(['navigate'])

const router = useRouter()
const { user, displayName, avatarUrl } = useAuth()
const { visitors, onlineCount } = usePresence()
const { isAdmin } = usePermissions()
const { recentlyActive } = useUserAccounts()

const recent = computed(() => recentlyActive.value.slice(0, RECENT_LIMIT))

// Presence records predate carrying a uid, so fall back to the session id for
// a stable — if not account-matched — face.
const visitorAvatar = (visitor) =>
  getAccountAvatarUrl({ photoURL: visitor.photoURL, uid: visitor.uid || visitor.id })

const goTo = (path) => {
  emit('navigate')
  router.push(path)
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex-1 overflow-y-auto no-scrollbar px-2 py-3 space-y-5">
      <!-- You -->
      <section>
        <p
          class="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-600"
        >
          You
        </p>

        <div class="flex items-center gap-3 px-2.5 py-2">
          <div class="relative shrink-0">
            <img
              :src="avatarUrl"
              alt=""
              class="h-9 w-9 rounded-full object-cover bg-gray-100 dark:bg-slate-800"
            />
            <span
              class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950"
            />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {{ displayName }}
            </p>
            <p class="text-xs text-gray-400 dark:text-slate-500 truncate">
              {{ user?.email }}
            </p>
          </div>
        </div>
      </section>

      <!-- Online now -->
      <section>
        <p
          class="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-600"
        >
          Active now
          <span v-if="onlineCount" class="text-primary dark:text-primary-light">
            &middot; {{ onlineCount }}
          </span>
        </p>

        <p
          v-if="!onlineCount"
          class="px-2.5 py-2 text-xs text-gray-400 dark:text-slate-500 leading-relaxed"
        >
          No one else is online right now.
        </p>

        <ul v-else class="space-y-0.5">
          <li
            v-for="visitor in visitors"
            :key="visitor.id"
            class="flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <div class="relative shrink-0">
              <img
                :src="visitorAvatar(visitor)"
                alt=""
                class="h-9 w-9 rounded-full object-cover bg-gray-100 dark:bg-slate-800"
              />
              <span
                class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950"
              />
            </div>
            <p
              class="min-w-0 flex-1 text-sm font-medium text-gray-700 dark:text-slate-200 truncate"
            >
              {{ visitor.name || 'Someone' }}
            </p>
          </li>
        </ul>
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
            <img
              :src="getAccountAvatarUrl(account)"
              alt=""
              class="h-9 w-9 shrink-0 rounded-full object-cover bg-gray-100 dark:bg-slate-800 opacity-60"
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
