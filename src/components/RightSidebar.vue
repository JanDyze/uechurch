<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  ChevronLeft,
  ChevronRight,
  ChevronRight as Chevron,
  Clock3,
  LogOut,
  Moon,
  Sun,
  UserPlus,
  Users,
  X,
} from '../icons'
import { usePresence } from '../composables/usePresence'
import { useAuth } from '../composables/useAuth'
import { useAvatars } from '../composables/useAvatars'
import { useFocusTrap } from '../composables/useFocusTrap'
import { useSwipeDismiss } from '../composables/useSwipeDismiss'
import { useMediaQuery } from '../composables/useMediaQuery'
import ActivePeopleList from './people/ActivePeopleList.vue'
import MemberAvatar from './members/MemberAvatar.vue'
import { useTheme } from '../composables/useTheme'
import { useToast } from '../composables/useToast'
import { useMyMember } from '../composables/useMyMember'
import { getFullName } from '../utils/memberUtils'
import { useClaimFlow } from '../composables/useClaimFlow'

// The people rail. On a wide screen it is a permanent right-hand column, the
// way Facebook keeps its contacts list; anywhere narrower it collapses into a
// drawer opened from the Topbar, since the content column needs the width more
// than the rail does.
const { visitors, onlineCount, showPeoplePanel, isRailCollapsed, toggleRail } = usePresence()
const { displayName, logout } = useAuth()
const router = useRouter()

// On a phone this drawer is the account surface: who you are, your profile and
// the theme, alongside who else is here. Notifications keep a drawer of their
// own off the bell - they are a feed you come to read, not a setting.
const { isDark, toggleTheme } = useTheme()
const { isLinked } = useMyMember()

const { accountMember, accountAvatarUrl, myMember, myAvatarUrl } = useAvatars()

const toast = useToast()
const signingOut = ref(false)

const handleLogout = async () => {
  if (signingOut.value) return
  signingOut.value = true
  try {
    await logout()
    showPeoplePanel.value = false
    toast.success('Signed out')
    router.push('/login')
  } catch {
    toast.error('Could not sign out. Please try again.')
  } finally {
    signingOut.value = false
  }
}

// Not linked yet: the way to ask, or where the asking has got to. The sheet
// itself is Topbar's; the drawer steps aside so the sheet is not under it.
const { myClaim, myPendingClaim, openClaimSheet, handleWithdrawClaim } = useClaimFlow()

const askToLink = () => {
  showPeoplePanel.value = false
  openClaimSheet()
}

const openMyProfile = () => {
  showPeoplePanel.value = false
  router.push(`/members/${myMember.value.id || myMember.value.firestoreId}`)
}


// Collapsed, the rail is a strip of faces. Past a handful it would run off the
// bottom of a laptop screen, so the rest are counted instead.
const STRIP_LIMIT = 6
const stripVisitors = computed(() => visitors.value.slice(0, STRIP_LIMIT))
const stripOverflow = computed(() => Math.max(0, visitors.value.length - STRIP_LIMIT))

const visitorAccount = (visitor) => ({
  photoURL: visitor.photoURL,
  uid: visitor.uid || visitor.id,
})
const visitorAvatar = (visitor) => accountAvatarUrl(visitorAccount(visitor))
const visitorMember = (visitor) => accountMember(visitorAccount(visitor))

// The tally counts you, which is why the list does too.
const onlineLabel = computed(() =>
  onlineCount.value
    ? `You and ${onlineCount.value} ${onlineCount.value === 1 ? 'other' : 'others'} online`
    : 'You are the only one online'
)

// Came in from the right, so it goes back out that way. The whole panel is the
// target; the people list still scrolls, because the swipe stands down unless
// a vertical drag is clearly horizontal instead.
const { swipeTarget: drawerSwipe, swipeStyle: drawerStyle } = useSwipeDismiss({
  direction: 'right',
  onDismiss: () => {
    showPeoplePanel.value = false
  },
})

const drawerRef = ref(null)
useFocusTrap(drawerRef, showPeoplePanel, () => {
  showPeoplePanel.value = false
})

// A drawer left open behind the breakpoint would be invisible but still
// trapping focus, so close it the moment the permanent rail takes over.
const railIsVisible = useMediaQuery('(min-width: 1280px)')
watch(railIsVisible, (visible) => {
  if (visible) showPeoplePanel.value = false
})
</script>

<template>
  <!-- Permanent rail — wide screens only -->
  <aside
    :class="[
      'hidden xl:flex xl:flex-col shrink-0 bg-white dark:bg-slate-950 border-l border-gray-200 dark:border-slate-800 transition-all duration-300 no-print',
      isRailCollapsed ? 'w-16' : 'w-72',
    ]"
  >
    <div
      class="shrink-0 flex items-center gap-2 h-12 px-3 border-b border-gray-100 dark:border-slate-900"
    >
      <template v-if="!isRailCollapsed">
        <Users class="h-4 w-4 shrink-0 text-primary dark:text-primary-light" />
        <h2 class="flex-1 text-sm font-bold text-gray-900 dark:text-white">Online Souls</h2>
        <span
          class="flex items-center gap-1.5 text-xs font-semibold text-gray-400 dark:text-slate-500"
          :title="onlineLabel"
          :aria-label="onlineLabel"
        >
          <span class="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
          {{ onlineCount + 1 }}
        </span>
      </template>

      <button
        @click="toggleRail"
        :class="[
          'flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-white/5 transition-colors',
          isRailCollapsed ? 'mx-auto' : '',
        ]"
        :title="isRailCollapsed ? 'Show online souls' : 'Hide online souls'"
        :aria-label="isRailCollapsed ? 'Show online souls' : 'Hide online souls'"
        :aria-expanded="!isRailCollapsed"
      >
        <ChevronLeft v-if="isRailCollapsed" class="h-4 w-4" />
        <ChevronRight v-else class="h-4 w-4" />
      </button>
    </div>

    <ActivePeopleList v-if="!isRailCollapsed" class="flex-1 min-h-0" />

    <!-- Collapsed: faces only, still live -->
    <div v-else class="flex-1 min-h-0 overflow-y-auto no-scrollbar py-3">
      <button
        @click="toggleRail"
        class="w-full flex justify-center py-1.5"
        :title="`${displayName} (you)`"
        :aria-label="`${displayName} (you). Show online souls`"
      >
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
      </button>

      <button
        v-for="visitor in stripVisitors"
        :key="visitor.id"
        @click="toggleRail"
        class="w-full flex justify-center py-1.5"
        :title="
          visitor.sessionCount > 1
            ? `${visitor.name || 'Someone'} · ${visitor.sessionCount} devices`
            : visitor.name || 'Someone'
        "
        :aria-label="`${visitor.name || 'Someone'} is active now. Show online souls`"
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
      </button>

      <button
        v-if="stripOverflow"
        @click="toggleRail"
        class="w-full flex justify-center py-1.5"
        :aria-label="`${stripOverflow} more souls online. Show online souls`"
      >
        <span
          class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800 text-xs font-bold text-gray-500 dark:text-slate-400"
        >
          +{{ stripOverflow }}
        </span>
      </button>
    </div>
  </aside>

  <!-- Drawer — phones, tablets and narrow laptops -->
  <Teleport to="body">
    <Transition name="people-drawer">
      <div v-if="showPeoplePanel" class="xl:hidden fixed inset-0 z-90 no-print">
        <div class="absolute inset-0 bg-black/50" @click="showPeoplePanel = false" />

        <div
          ref="drawerRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="people-drawer-title"
          tabindex="-1"
          v-bind="drawerSwipe"
          :style="drawerStyle()"
          class="people-panel absolute inset-y-0 right-0 w-[19rem] max-w-[85vw] flex flex-col bg-white dark:bg-slate-950 shadow-2xl border-l border-gray-200 dark:border-slate-800"
        >
          <!-- Who you are, first: this drawer is the account surface on a
               phone, not only the list of who else is here. The name is the
               way into your own profile - the chevron says so, so nothing has
               to spell it out - and the address is not shown at all, since you
               are the one person who does not need telling. -->
          <div
            class="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-slate-900 pt-[calc(0.75rem+env(safe-area-inset-top))]"
          >
            <component
              :is="isLinked ? 'button' : 'div'"
              v-bind="isLinked ? { onClick: openMyProfile, 'aria-label': 'My profile' } : {}"
              :class="[
                'flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left transition-colors',
                isLinked ? '-m-1 p-1 hover:bg-gray-100 dark:hover:bg-white/5' : '',
              ]"
            >
              <MemberAvatar
                :member="myMember"
                :src="myAvatarUrl"
                alt=""
                size="w-10 h-10"
                plain-class="border-2 border-primary/20"
              />
              <span class="min-w-0 flex-1">
                <span
                  id="people-drawer-title"
                  class="block truncate text-sm font-bold text-gray-900 dark:text-white"
                >
                  {{ isLinked ? getFullName(myMember) : displayName }}
                </span>
              </span>
              <Chevron
                v-if="isLinked"
                class="h-4 w-4 shrink-0 text-gray-300 dark:text-slate-600"
              />
            </component>
            <button
              @click="showPeoplePanel = false"
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              aria-label="Close"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <!-- An account that is nobody on the roll yet. Here as well as in the
               desktop dropdown, because a phone never sees that dropdown. -->
          <div
            v-if="!isLinked"
            class="shrink-0 border-b border-gray-100 px-3 py-2 dark:border-slate-900"
          >
            <div v-if="myPendingClaim" class="rounded-xl bg-amber-50 p-2.5 dark:bg-amber-500/10">
              <p
                class="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400"
              >
                <Clock3 class="h-3.5 w-3.5" />
                Awaiting approval
              </p>
              <p class="mt-1 truncate text-xs font-bold text-gray-900 dark:text-white">
                {{ myPendingClaim.memberName }}
              </p>
              <button
                @click="handleWithdrawClaim"
                class="mt-1.5 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400 transition-colors hover:text-red-500"
              >
                Withdraw request
              </button>
            </div>
            <button
              v-else
              @click="askToLink"
              class="flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left transition-colors hover:bg-gray-100 dark:hover:bg-white/5"
            >
              <UserPlus class="h-4 w-4 shrink-0 text-primary dark:text-primary-light" />
              <span class="min-w-0 flex-1">
                <span class="block text-[11px] font-bold text-gray-900 dark:text-white">
                  Link my member record
                </span>
                <span
                  v-if="myClaim && myClaim.status === 'rejected'"
                  class="block truncate text-[10px] text-red-500"
                >
                  Last request was declined
                </span>
              </span>
              <Chevron class="h-4 w-4 shrink-0 text-gray-300 dark:text-slate-600" />
            </button>
          </div>

          <div class="shrink-0 border-b border-gray-100 px-3 py-2 dark:border-slate-900">
            <!-- The toggle used to be its own button on the topbar. -->
            <button
              @click="toggleTheme($event)"
              class="flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left transition-colors hover:bg-gray-100 dark:hover:bg-white/5"
            >
              <Sun v-if="isDark" class="h-4 w-4 shrink-0 text-primary dark:text-primary-light" />
              <Moon v-else class="h-4 w-4 shrink-0 text-primary dark:text-primary-light" />
              <span class="flex-1 text-[11px] font-bold text-gray-900 dark:text-white">
                {{ isDark ? 'Light mode' : 'Dark mode' }}
              </span>
            </button>
          </div>

          <div class="flex shrink-0 items-center gap-2 px-4 pt-3 pb-1.5">
            <Users class="h-3.5 w-3.5 text-gray-400 dark:text-slate-500" />
            <h3 class="flex-1 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-slate-500">
              Online
            </h3>
            <span
              class="flex items-center gap-1.5 text-xs font-semibold text-gray-400 dark:text-slate-500"
              :title="onlineLabel"
              :aria-label="onlineLabel"
            >
              <span class="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
              {{ onlineCount + 1 }}
            </span>
          </div>

          <ActivePeopleList class="flex-1 min-h-0 overscroll-contain" @navigate="showPeoplePanel = false" />

          <!-- Last thing in the drawer, under everything it belongs to: this is
               the account surface on a phone, and signing out is the one action
               here you do not want to hit by accident on the way past. -->
          <div
            class="shrink-0 border-t border-gray-100 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-slate-900"
          >
            <button
              @click="handleLogout"
              :disabled="signingOut"
              class="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-[10px] font-black uppercase tracking-widest text-gray-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:border-slate-800 dark:text-slate-400 dark:hover:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            >
              <LogOut class="h-3.5 w-3.5" />
              {{ signingOut ? 'Signing out…' : 'Sign out' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.people-drawer-enter-active,
.people-drawer-leave-active {
  transition: opacity 0.25s ease;
}

.people-drawer-enter-active .people-panel,
.people-drawer-leave-active .people-panel {
  transition: transform 0.25s ease;
}

.people-drawer-enter-from,
.people-drawer-leave-to {
  opacity: 0;
}

.people-drawer-enter-from .people-panel,
.people-drawer-leave-to .people-panel {
  transform: translateX(100%);
}
</style>
