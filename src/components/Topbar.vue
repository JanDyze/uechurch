<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { Bell, Sun, Moon, X, Users, LogOut, UserCheck, UserPlus, Clock3, ChevronRight } from "lucide-vue-next";
import { useRouter } from "vue-router";
import { useTheme } from "../composables/useTheme";
import { useNotifications } from "../composables/useNotifications";
import { subscribeToNotifications } from "../api/notifyService";
import { useFocusTrap } from "../composables/useFocusTrap";
import { useAuth } from "../composables/useAuth";
import { useToast } from "../composables/useToast";
import { useMembers } from "../composables/useMembers";
import { useMyMember } from "../composables/useMyMember";
import { useMemberClaims } from "../composables/useMemberClaims";
import { usePresence } from "../composables/usePresence";
import { getFullName } from "../utils/memberUtils";
import ClaimMemberSheet from "./auth/ClaimMemberSheet.vue";

const route = useRoute();
const router = useRouter();
const { isDark, toggleTheme } = useTheme();
const { displayName, email: userEmail, avatarUrl, logout } = useAuth();
const toast = useToast();
const { isEnabled: notificationsEnabled, enabling, enable } = useNotifications();

// Notifications panel + history
const isNotifOpen = ref(false);
const notifications = ref([]);
const lastSeenNotif = ref(Number(localStorage.getItem("uec_notif_last_seen") || 0));

const unreadCount = computed(
  () =>
    notifications.value.filter((n) => n.sentAt && n.sentAt.toMillis() > lastSeenNotif.value)
      .length
);

const toggleNotifPanel = () => {
  isNotifOpen.value = !isNotifOpen.value;
  if (isNotifOpen.value) {
    lastSeenNotif.value = Date.now();
    localStorage.setItem("uec_notif_last_seen", String(lastSeenNotif.value));
  }
};

const openNotification = (n) => {
  isNotifOpen.value = false;
  const url = n.url || "/";
  if (url.startsWith("http")) window.open(url, "_blank");
  else router.push(url);
};

const timeAgo = (ts) => {
  if (!ts) return "just now";
  const s = Math.floor((Date.now() - ts.toMillis()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return ts.toDate().toLocaleDateString();
};

let unsubscribeNotifications = null;
onMounted(() => {
  unsubscribeNotifications = subscribeToNotifications((list) => (notifications.value = list));
});
onUnmounted(() => unsubscribeNotifications?.());
const isMenuOpen = ref(false);

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;
};

const pageTitle = computed(() => {
  const routeNames = {
    Home: 'Dashboard',
    MemberDetails: 'Member',
    MinuteDetails: 'Minutes',
    PrayerConcerns: 'Prayer Concerns',
    FinanceAudit: 'Yearly Report'
  };
  // Fall back to the route name so new pages are labelled correctly
  return routeNames[route.name] || route.name || 'Dashboard';
});

// Live presence now belongs to the people rail; the Topbar only carries the
// button that opens it on screens too narrow for the permanent column.
const { onlineCount, showPeoplePanel, togglePeoplePanel } = usePresence()

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
const { myClaim, myPendingClaim, submitClaim, withdraw } = useMemberClaims()

const showClaimSheet = ref(false)
const submittingClaim = ref(false)

const openClaimSheet = () => {
  isUserMenuOpen.value = false
  showClaimSheet.value = true
}

const handleClaimSubmit = async (member) => {
  submittingClaim.value = true
  try {
    await submitClaim(member)
    showClaimSheet.value = false
    toast.success(`Request sent. An administrator will review it.`)
  } catch (e) {
    console.error('Error requesting member link:', e)
    toast.error('Could not send the request. Please try again.')
  } finally {
    submittingClaim.value = false
  }
}

const handleWithdrawClaim = async () => {
  try {
    await withdraw(myPendingClaim.value)
    toast.success('Request withdrawn')
  } catch (e) {
    console.error('Error withdrawing member claim:', e)
    toast.error('Could not withdraw the request.')
  }
}

const openMyProfile = () => {
  isUserMenuOpen.value = false
  router.push(`/members/${myMember.value.id || myMember.value.firestoreId}`)
}

</script>

<template>
  <header class="bg-white dark:bg-gray-800 sticky top-0 z-70 no-print">
    <div class="px-4 sm:px-6 lg:px-4">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center gap-3">
          <div>
            <div class="text-xl font-bold text-primary dark:text-primary-light">
              {{ pageTitle }}
            </div>
          </div>
        </div>
        <!-- Right: User menu and notifications -->
        <div class="flex items-center gap-2">
          <!-- Who is online. The permanent rail replaces this from xl up. -->
          <button
            @click="togglePeoplePanel"
            class="xl:hidden relative p-2 rounded-full text-primary dark:text-primary-light hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Who is online"
            aria-label="Who is online"
            aria-haspopup="dialog"
            :aria-expanded="showPeoplePanel"
          >
            <Users class="w-6 h-6" />
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
            class="p-2 rounded-full text-primary dark:text-primary-light hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <Sun v-if="isDark" class="w-5 h-5" />
            <Moon v-else class="w-5 h-5" />
          </button>

          <!-- Notifications -->
          <div class="relative">
            <button
              @click="toggleNotifPanel"
              class="p-2 rounded-full text-primary dark:text-primary-light hover:bg-gray-100 dark:hover:bg-gray-700 relative"
              title="Notifications"
              aria-label="Notifications"
              aria-haspopup="true"
              :aria-expanded="isNotifOpen"
            >
              <Bell class="w-6 h-6" />
              <span
                v-if="unreadCount > 0"
                class="absolute top-1 right-1 w-2 h-2 bg-[#bc1c09] rounded-full"
              ></span>
            </button>

            <!-- Click-away overlay -->
            <div
              v-if="isNotifOpen"
              class="fixed inset-0 z-90"
              @click="isNotifOpen = false"
            ></div>

            <!-- Notifications Panel -->
            <Transition name="fade">
              <div
                v-if="isNotifOpen"
                ref="notifPanelRef"
                role="dialog"
                aria-labelledby="notif-panel-title"
                tabindex="-1"
                class="absolute top-full right-0 mt-3 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-900 border-2 border-primary/20 dark:border-primary-light/20 rounded-2xl shadow-2xl z-100 overflow-hidden"
              >
                <div class="flex items-center justify-between px-4 pt-4 pb-2">
                  <p id="notif-panel-title" class="text-[9px] font-black uppercase tracking-widest text-primary">
                    Notifications
                  </p>
                  <button
                    @click="isNotifOpen = false"
                    aria-label="Close"
                    class="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
                  >
                    <X class="w-3 h-3" />
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
                  class="max-h-80 overflow-y-auto custom-scrollbar border-t-2 border-gray-50 dark:border-gray-800"
                >
                  <p
                    v-if="notifications.length === 0"
                    class="p-6 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400"
                  >
                    No notifications yet
                  </p>
                  <button
                    v-for="n in notifications"
                    :key="n.id"
                    @click="openNotification(n)"
                    class="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-50 dark:border-gray-800/60 last:border-b-0"
                  >
                    <p class="text-[11px] font-black text-gray-900 dark:text-white leading-snug">
                      {{ n.title }}
                    </p>
                    <p
                      v-if="n.body"
                      class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2"
                    >
                      {{ n.body }}
                    </p>
                    <p
                      class="text-[9px] font-black uppercase tracking-widest text-gray-300 dark:text-gray-500 mt-1"
                    >
                      {{ timeAgo(n.sentAt) }}
                    </p>
                  </button>
                </div>
              </div>
            </Transition>
          </div>

          <!-- User account menu -->
          <div class="relative">
            <button
              @click="isUserMenuOpen = !isUserMenuOpen"
              aria-label="User menu"
              aria-haspopup="true"
              :aria-expanded="isUserMenuOpen"
              class="flex items-center gap-2 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <img
                :src="avatarUrl"
                alt="User Avatar"
                class="w-8 h-8 rounded-full object-cover"
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
                v-if="isUserMenuOpen"
                ref="userMenuRef"
                role="dialog"
                aria-labelledby="user-menu-title"
                tabindex="-1"
                class="absolute top-full right-0 mt-3 w-64 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-900 border-2 border-primary/20 dark:border-primary-light/20 rounded-2xl shadow-2xl z-100 overflow-hidden"
              >
                <div class="flex items-center gap-3 p-4">
                  <img
                    :src="avatarUrl"
                    alt=""
                    class="w-10 h-10 rounded-full object-cover border-2 border-primary/20"
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
</style>
