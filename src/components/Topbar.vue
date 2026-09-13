<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { Bell, Sun, Moon, X, Users, LogOut, UserCheck, UserPlus, Clock3, ChevronRight } from '../icons';
import { useRouter } from "vue-router";
import { useTheme } from "../composables/useTheme";
import { useNotifications } from "../composables/useNotifications";
import { useNotificationFeed, timeAgo } from "../composables/useNotificationFeed";
import { useFocusTrap } from "../composables/useFocusTrap";
import { useSwipeDismiss } from "../composables/useSwipeDismiss";
import { useAuth } from "../composables/useAuth";
import { useAvatars } from "../composables/useAvatars";
import { useToast } from "../composables/useToast";
import { useMembers } from "../composables/useMembers";
import { useMyMember } from "../composables/useMyMember";
import { useClaimFlow } from "../composables/useClaimFlow";
import { usePresence } from "../composables/usePresence";
import { useMediaQuery } from "../composables/useMediaQuery";
import { usePermissions } from "../composables/usePermissions";
import { useAppSettings } from "../composables/useAppSettings";
import { canReceive } from "../../lib/notifications";
import { notificationIcon, toneClass } from "../utils/notificationIcons";
import { getFullName } from "../utils/memberUtils";
import ClaimMemberSheet from "./auth/ClaimMemberSheet.vue";
import MemberAvatar from "./members/MemberAvatar.vue";

const route = useRoute();
const router = useRouter();
const { isDark, toggleTheme } = useTheme();
const { displayName, email: userEmail, logout } = useAuth();
// Prefers the linked member record's photo over the sign-in thumbnail.
const { myAvatarUrl } = useAvatars();
const toast = useToast();
const { isEnabled: notificationsEnabled, enabling, enable } = useNotifications();

// The mark doubles as the way out to the church's public page. Only offered
// when that page is actually published: with the landing page turned off "/"
// is not a destination, and a link that bounces you back where you started is
// worse than no link.
const { church, logoUrl, landing } = useAppSettings();
const showPublicLink = computed(() => landing.value.enabled !== false);

// No digest switch here any more: the digest is simply sent. api/email.js has
// always treated it as opt-out, so an account that never touches a setting
// gets one — which is what "automatic" means. Administrators still have the
// wider controls in Settings.

// Notifications panel + history
const isNotifOpen = ref(false);
const { isAdmin, capabilities } = usePermissions();
const { visibleNotifications, unreadCount, markSeen } = useNotificationFeed();

const toggleNotifPanel = () => {
  isNotifOpen.value = !isNotifOpen.value;
  if (isNotifOpen.value) markSeen();
};

const openNotification = (n) => {
  isNotifOpen.value = false;
  const url = n.url || "/";
  if (url.startsWith("http")) window.open(url, "_blank");
  else router.push(url);
};

const isMenuOpen = ref(false);

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;
};

const pageTitle = computed(() => {
  const routeNames = {
    Home: 'Dashboard',
    Members: 'People',
    MemberDetails: 'Person',
    MinuteDetails: 'Minutes',
    PrayerConcerns: 'Prayer Concerns'
  };
  // Fall back to the route name so new pages are labelled correctly
  return routeNames[route.name] || route.name || 'Dashboard';
});

// Live presence now belongs to the people rail; the Topbar only carries the
// button that opens it on screens too narrow for the permanent column.
const { onlineCount, showPeoplePanel, togglePeoplePanel } = usePresence()

// The dropdown is a desktop affordance; a phone gets the drawer instead.
const isDesktop = useMediaQuery('(min-width: 1024px)')

// Same gesture as the drawer beside it, so the two behave alike.
const { swipeTarget: notifSwipe, swipeStyle: notifStyle } = useSwipeDismiss({
  direction: 'right',
  onDismiss: () => {
    isNotifOpen.value = false
  },
})

const notifPanelRef = ref(null)
useFocusTrap(notifPanelRef, isNotifOpen, () => { isNotifOpen.value = false }, { trap: false })

// User account menu
const isUserMenuOpen = ref(false)
const signingOut = ref(false)
const userMenuRef = ref(null)
useFocusTrap(userMenuRef, isUserMenuOpen, () => { isUserMenuOpen.value = false }, { trap: false })

const handleLogout = async () => {
  signingOut.value = true
  try {
    await logout()
    isUserMenuOpen.value = false
    toast.success('Signed out')
    router.push('/login')
  } catch {
    toast.error('Could not sign out. Please try again.')
  } finally {
    signingOut.value = false
  }
}

/* --------------------------------------------------- linked member record */
const { members } = useMembers()
const { myMember, isLinked } = useMyMember()
const {
  myClaim,
  myPendingClaim,
  showClaimSheet,
  submittingClaim,
  openClaimSheet: openSharedClaimSheet,
  handleClaimSubmit,
  handleWithdrawClaim,
} = useClaimFlow()

const openClaimSheet = () => {
  isUserMenuOpen.value = false
  openSharedClaimSheet()
}

const openMyProfile = () => {
  isUserMenuOpen.value = false
  router.push(`/members/${myMember.value.id || myMember.value.firestoreId}`)
}

</script>

<template>
  <!-- Deliberately slight: this bar says where you are and gives you your
       account, and every row it takes is a row the page does not get. A hairline
       under it does the work the old height and weight were doing. -->
  <header
    class="sticky top-0 z-70 no-print border-b border-gray-100 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-800/90"
  >
    <div class="px-4 sm:px-6 lg:px-4">
      <div class="flex items-center justify-between h-12">
        <div class="flex min-w-0 items-center gap-2.5">
          <router-link
            v-if="showPublicLink"
            to="/"
            :title="`Go to the ${church.shortName} public page`"
            :aria-label="`Go to the ${church.shortName} public page`"
            class="-ml-1 flex shrink-0 items-center rounded-lg p-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <img :src="logoUrl" :alt="church.shortName" class="h-8 w-auto" />
          </router-link>
          <h1 class="min-w-0 truncate text-sm font-semibold text-gray-900 dark:text-white">
            {{ pageTitle }}
          </h1>
        </div>
        <!-- Right: User menu and notifications -->
        <div class="flex items-center gap-2">
          <!-- Who is online. The permanent rail replaces this from xl up. -->
          <button
            @click="togglePeoplePanel"
            class="hidden lg:relative lg:inline-flex xl:hidden p-1.5 rounded-full text-primary dark:text-primary-light hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Who is online"
            aria-label="Who is online"
            aria-haspopup="dialog"
            :aria-expanded="showPeoplePanel"
          >
            <Users class="w-5 h-5" />
            <span
              v-if="onlineCount"
              class="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-emerald-500 text-white text-[9px] font-black"
            >
              {{ onlineCount }}
            </span>
          </button>

          <!-- Theme Toggle -->
          <button
            @click="toggleTheme($event)"
            class="hidden lg:inline-flex p-1.5 rounded-full text-primary dark:text-primary-light hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <Sun v-if="isDark" class="w-4 h-4" />
            <Moon v-else class="w-4 h-4" />
          </button>

          <!-- Notifications, at every size. A feed you come to read earns its
               own drawer rather than a menu hanging off the bar. -->
          <div>
            <button
              @click="toggleNotifPanel"
              class="p-1.5 rounded-full text-primary dark:text-primary-light hover:bg-gray-100 dark:hover:bg-gray-700 relative"
              title="Notifications"
              aria-label="Notifications"
              aria-haspopup="true"
              :aria-expanded="isNotifOpen"
            >
              <Bell class="w-5 h-5" />
              <span
                v-if="unreadCount > 0"
                class="absolute top-1 right-1 w-2 h-2 bg-[#bc1c09] rounded-full"
              ></span>
            </button>

          </div>

          <!-- User account menu -->
          <div class="relative">
            <!-- One control on a phone. The theme toggle, the bell and the
                 who-is-online button all used to sit out here beside it, which
                 is four taps' worth of chrome on a 360px bar; they are all in
                 the drawer this opens now. A desktop still gets the dropdown,
                 since it has the room for the separate buttons. -->
            <button
              @click="isDesktop ? (isUserMenuOpen = !isUserMenuOpen) : togglePeoplePanel()"
              aria-label="Account, notifications and who is online"
              aria-haspopup="true"
              :aria-expanded="isDesktop ? isUserMenuOpen : showPeoplePanel"
              class="relative flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <MemberAvatar
                :member="myMember"
                :src="myAvatarUrl"
                alt="User Avatar"
                size="w-7 h-7"
              />
              <!-- The bell is gone from the bar, so its badge rides here. -->
              <span
                v-if="unreadCount > 0"
                class="lg:hidden absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#bc1c09] ring-2 ring-white dark:ring-gray-800"
              />
            </button>

            <!-- Click-away overlay -->
            <div
              v-if="isUserMenuOpen"
              class="fixed inset-0 z-90"
              @click="isUserMenuOpen = false"
            ></div>

            <Transition name="fade">
              <div
                v-if="isUserMenuOpen && isDesktop"
                ref="userMenuRef"
                role="dialog"
                aria-labelledby="user-menu-title"
                tabindex="-1"
                class="absolute top-full right-0 mt-3 w-64 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-900 border-2 border-primary/20 dark:border-primary-light/20 rounded-2xl shadow-2xl z-100 overflow-hidden"
              >
                <div class="flex items-center gap-3 p-4">
                  <MemberAvatar
                    :member="myMember"
                    :src="myAvatarUrl"
                    alt=""
                    size="w-10 h-10"
                    plain-class="border-2 border-primary/20"
                  />
                  <div class="min-w-0">
                    <p
                      id="user-menu-title"
                      class="text-[11px] font-black text-gray-900 dark:text-white truncate"
                    >
                      {{ displayName }}
                    </p>
                    <p class="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                      {{ userEmail }}
                    </p>
                  </div>
                </div>

                <!-- Which member record this account is, if any -->
                <div class="px-3 pb-3 border-t-2 border-gray-50 dark:border-gray-800 pt-3">
                  <button
                    v-if="isLinked"
                    @click="openMyProfile"
                    class="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-primary/5 dark:bg-primary/10 text-left hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors"
                  >
                    <UserCheck class="w-4 h-4 shrink-0 text-primary dark:text-primary-light" />
                    <span class="flex-1 min-w-0">
                      <span class="block text-[9px] font-black uppercase tracking-widest text-primary dark:text-primary-light">
                        My profile
                      </span>
                      <span class="block text-[11px] font-bold text-gray-900 dark:text-white truncate">
                        {{ getFullName(myMember) }}
                      </span>
                    </span>
                    <ChevronRight class="w-4 h-4 shrink-0 text-gray-300 dark:text-gray-600" />
                  </button>

                  <div
                    v-else-if="myPendingClaim"
                    class="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10"
                  >
                    <p class="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                      <Clock3 class="w-3.5 h-3.5" />
                      Awaiting approval
                    </p>
                    <p class="mt-1 text-[11px] font-bold text-gray-900 dark:text-white truncate">
                      {{ myPendingClaim.memberName }}
                    </p>
                    <button
                      @click="handleWithdrawClaim"
                      class="mt-1.5 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Withdraw request
                    </button>
                  </div>

                  <button
                    v-else
                    @click="openClaimSheet"
                    class="w-full flex items-center gap-2.5 p-2.5 rounded-xl border-2 border-dashed border-gray-100 dark:border-gray-800 text-left hover:border-primary/40 transition-colors"
                  >
                    <UserPlus class="w-4 h-4 shrink-0 text-gray-400" />
                    <span class="flex-1 min-w-0">
                      <span class="block text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                        Link my member record
                      </span>
                      <span
                        v-if="myClaim && myClaim.status === 'rejected'"
                        class="block text-[10px] text-red-500 truncate"
                      >
                        Last request was declined
                      </span>
                    </span>
                  </button>
                </div>

                <div class="px-3 pb-3 border-t-2 border-gray-50 dark:border-gray-800 pt-3">
                  <button
                    @click="handleLogout"
                    :disabled="signingOut"
                    class="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 hover:border-red-100 dark:hover:border-red-500/20 transition-all disabled:opacity-50"
                  >
                    <LogOut class="w-3.5 h-3.5" />
                    {{ signingOut ? 'Signing out...' : 'Sign out' }}
                  </button>
                </div>
              </div>
            </Transition>
          </div>

        </div>
      </div>
    </div>


    <!-- Notifications drawer. Same shape as the people drawer it sits beside,
         so the two read as one family rather than a menu and a panel. -->
    <Teleport to="body">
      <Transition name="notif-drawer">
        <div v-if="isNotifOpen" class="fixed inset-0 z-110 no-print">
          <div class="absolute inset-0 bg-black/50" @click="isNotifOpen = false" />
              <div
                v-if="isNotifOpen"
                ref="notifPanelRef"
                role="dialog"
                aria-labelledby="notif-panel-title"
                tabindex="-1"
                v-bind="notifSwipe"
                :style="notifStyle()"
                class="notif-panel absolute inset-y-0 right-0 flex w-[21rem] max-w-[85vw] flex-col bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-800"
              >
                <div
                  class="shrink-0 flex items-center justify-between px-4 pb-2 pt-[calc(1rem+env(safe-area-inset-top))]"
                >
                  <p id="notif-panel-title" class="text-[9px] font-black uppercase tracking-widest text-primary">
                    Notifications
                  </p>
                  <button
                    @click="isNotifOpen = false"
                    aria-label="Close"
                    class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <X class="w-5 h-5" />
                  </button>
                </div>

                <!-- Enable state -->
                <div v-if="!notificationsEnabled" class="px-4 pb-3">
                  <button
                    @click="enable"
                    :disabled="enabling"
                    class="w-full py-2.5 bg-primary text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50"
                  >
                    {{ enabling ? "Enabling..." : "Enable on this device" }}
                  </button>
                </div>
                <div v-else class="px-4 pb-2 flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                  <span class="text-[9px] font-black uppercase tracking-widest text-gray-400">
                    Enabled on this device
                  </span>
                </div>

                <!-- History -->
                <div
                  class="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar border-t-2 border-gray-50 dark:border-gray-800 pb-[env(safe-area-inset-bottom)]"
                >
                  <p
                    v-if="visibleNotifications.length === 0"
                    class="p-6 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400"
                  >
                    No notifications yet
                  </p>
                  <button
                    v-for="n in visibleNotifications"
                    :key="n.id"
                    @click="openNotification(n)"
                    class="w-full flex items-start gap-2.5 text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-50 dark:border-gray-800/60 last:border-b-0"
                  >
                    <!-- What kind of thing happened, before a word is read -->
                    <span
                      :class="['shrink-0 mt-0.5 p-1.5 rounded-lg', toneClass(n.kind)]"
                    >
                      <component :is="notificationIcon(n.kind)" class="w-3.5 h-3.5" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block text-[11px] font-black text-gray-900 dark:text-white leading-snug">
                        {{ n.title }}
                      </span>
                      <span
                        v-if="n.body"
                        class="block text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2"
                      >
                        {{ n.body }}
                      </span>
                      <span
                        class="block text-[9px] font-black uppercase tracking-widest text-gray-300 dark:text-gray-500 mt-1"
                      >
                        {{ timeAgo(n.sentAt) }}
                      </span>
                    </span>
                  </button>
                </div>
              </div>
                    </div>
      </Transition>
    </Teleport>

    <ClaimMemberSheet
      v-model:show="showClaimSheet"
      :members="members"
      :submitting="submittingClaim"
      @submit="handleClaimSubmit"
    />

  </header>
</template>

<style scoped>
/* Scrollbars are themed globally in src/style.css (.custom-scrollbar) */

.notif-drawer-enter-active,
.notif-drawer-leave-active {
  transition: opacity 0.25s ease;
}

.notif-drawer-enter-active .notif-panel,
.notif-drawer-leave-active .notif-panel {
  transition: transform 0.25s ease;
}

.notif-drawer-enter-from,
.notif-drawer-leave-to {
  opacity: 0;
}

.notif-drawer-enter-from .notif-panel,
.notif-drawer-leave-to .notif-panel {
  transform: translateX(100%);
}
</style>
