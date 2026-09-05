<script setup>
import { computed, ref } from 'vue'
import { usePermissions } from '../composables/usePermissions'
import { useRoute, useRouter } from 'vue-router'
import { useFocusTrap } from '../composables/useFocusTrap'
import {
  Home,
  Users,
  UsersRound,
  Calendar,
  Menu,
  X,
  ChevronRight,
  FileText,
  ClipboardCheck,
  Heart,
  Image,
  Link2,
  ListChecks,
  NotebookPen,
  ListMusic,
  Mic2,
  Settings,
  UserCog,
} from '../icons'

const route = useRoute()
const router = useRouter()
const { can, isAdmin } = usePermissions()
const showMoreMenu = ref(false)

// Four tabs plus More. Attendance sits out here rather than in the sheet
// because it is recorded on a phone, week in week out, right after the
// gathering it belongs to - two taps behind a menu is one too many for the
// thing people open this app to do.
const allPrimaryNav = [
  { name: 'Dashboard', path: '/dashboard', icon: Home, capability: 'dashboard.view' },
  { name: 'People', path: '/members', icon: Users, capability: 'members.view' },
  { name: 'Events', path: '/events', icon: Calendar, capability: 'events.view' },
  { name: 'Attendance', path: '/attendance', icon: ClipboardCheck, capability: 'attendance.view' },
]

// Same grouping as the desktop sidebar, minus the primary tabs, so the two
// navs teach the same map of the app.
const MORE_GROUPS = [
  {
    // Its own group at the top rather than filed under Gatherings: a to-do
    // list is not about a meeting, and burying it under one is how a shared
    // list quietly stops being opened.
    key: 'overview',
    label: 'Overview',
    items: [{ name: 'Tasks', path: '/tasks', icon: ListChecks, capability: 'tasks.view' }],
  },
  {
    key: 'people',
    label: 'People',
    items: [
      { name: 'Small Groups', path: '/small-groups', icon: UsersRound, capability: 'smallgroups.view' },
    ],
  },
  {
    key: 'gatherings',
    label: 'Gatherings',
    items: [
      { name: 'Song List', path: '/songs', icon: ListMusic, capability: 'songs.view' },
      { name: 'Lineups', path: '/lineups', icon: Mic2, capability: 'lineups.view' },
      { name: 'Minutes', path: '/minutes', icon: FileText, capability: 'minutes.view' },
      { name: 'Prayer Concerns', path: '/prayer-concerns', icon: Heart, capability: 'prayer.view' },
    ],
  },
  {
    key: 'media',
    label: 'Media',
    items: [
      { name: 'Gallery', path: '/gallery', icon: Image, capability: 'gallery.view' },
      { name: 'Links', path: '/links', icon: Link2, capability: 'links.view' },
    ],
  },
  {
    key: 'admin',
    label: 'Administration',
    items: [
      { name: 'To-do', path: '/todo', icon: NotebookPen, adminOnly: true },
      { name: 'Accounts', path: '/accounts', icon: UserCog, adminOnly: true },
      { name: 'Settings', path: '/settings', icon: Settings, adminOnly: true },
    ],
  },
]

// A page nobody can open should not advertise itself in the nav, and a group
// left empty by that filtering is dropped with it.
const allowed = (item) => (item.adminOnly ? isAdmin.value : can(item.capability))
const primaryNav = computed(() => allPrimaryNav.filter(allowed))
const moreGroups = computed(() =>
  MORE_GROUPS.map((g) => ({ ...g, items: g.items.filter(allowed) })).filter(
    (g) => g.items.length > 0
  )
)
const moreNav = computed(() => moreGroups.value.flatMap((g) => g.items))

const isActive = (path) => {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}

const isMoreActive = computed(() => moreNav.value.some((item) => isActive(item.path)))

const navigate = (path) => {
  showMoreMenu.value = false
  router.push(path)
}

const toggleMoreMenu = () => {
  showMoreMenu.value = !showMoreMenu.value
}

const closeMoreMenu = () => {
  showMoreMenu.value = false
}

const moreMenuRef = ref(null)
useFocusTrap(moreMenuRef, showMoreMenu, closeMoreMenu)
</script>

<template>
  <!-- More menu. The sheet reaches the bottom edge of the screen and covers the
       bar it was opened from: perched on top of that bar it left the tab strip
       competing for the thumb with the list it had just opened. -->
  <Transition name="more-sheet">
    <div
      v-if="showMoreMenu"
      class="lg:hidden fixed inset-0 z-55 flex flex-col justify-end no-print"
    >
      <div class="absolute inset-0 bg-black/50" @click="closeMoreMenu" />

      <div
        ref="moreMenuRef"
        role="dialog"
        aria-modal="true"
        aria-labelledby="more-menu-title"
        tabindex="-1"
        class="more-sheet-panel relative z-10 w-full max-h-[85dvh] flex flex-col rounded-t-2xl bg-white dark:bg-gray-800 shadow-2xl border-t border-gray-200 dark:border-gray-700"
      >
        <div class="shrink-0 rounded-t-2xl">
          <!-- Grab handle: reads as a sheet sitting on the screen edge rather
               than a popup hanging off the bar. -->
          <div class="flex justify-center pt-2.5 pb-1">
            <div class="h-1 w-9 rounded-full bg-gray-300 dark:bg-gray-600" />
          </div>
          <div class="flex items-center justify-between px-4 pb-3 border-b border-gray-100 dark:border-gray-700">
            <h3 id="more-menu-title" class="text-base font-semibold text-gray-900 dark:text-white">
              More
            </h3>
            <button
              @click="closeMoreMenu"
              class="-mr-2 p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close menu"
            >
              <X class="h-5 w-5" />
            </button>
          </div>
        </div>

        <!-- One column of full-width rows: a thumb runs down a list far faster
             than it hunts across a grid of half-width tiles. -->
        <nav class="flex-1 overflow-y-auto px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div v-for="group in moreGroups" :key="group.key">
            <p class="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              {{ group.label }}
            </p>
            <button
              v-for="item in group.items"
              :key="item.name"
              @click="navigate(item.path)"
              :class="[
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors',
                isActive(item.path)
                  ? 'bg-primary/10 text-primary dark:text-primary-light'
                  : 'text-gray-700 dark:text-gray-300 active:bg-gray-100 dark:active:bg-gray-700/50'
              ]"
              :aria-current="isActive(item.path) ? 'page' : undefined"
            >
              <span
                :class="[
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  isActive(item.path)
                    ? 'bg-primary/15'
                    : 'bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400'
                ]"
              >
                <component :is="item.icon" class="h-[18px] w-[18px]" />
              </span>
              <span class="flex-1 min-w-0 truncate text-sm font-medium">{{ item.name }}</span>
              <ChevronRight class="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
            </button>
          </div>
        </nav>
      </div>
    </div>
  </Transition>

  <nav class="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50 pb-[env(safe-area-inset-bottom)] no-print">
    <div class="flex items-center h-16">
      <button
        v-for="item in primaryNav"
        :key="item.name"
        @click="navigate(item.path)"
        :class="[
          'flex min-w-0 flex-1 flex-col items-center justify-center h-full px-0.5 transition-colors',
          isActive(item.path)
            ? 'text-primary dark:text-primary-light'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        ]"
        :aria-current="isActive(item.path) ? 'page' : undefined"
      >
        <component :is="item.icon" class="h-6 w-6 mb-0.5 shrink-0" />
        <span class="w-full truncate text-center text-[11px] font-medium leading-tight">
          {{ item.name }}
        </span>
      </button>

      <button
        @click="toggleMoreMenu"
        :class="[
          'flex min-w-0 flex-1 flex-col items-center justify-center h-full px-0.5 transition-colors',
          showMoreMenu || isMoreActive
            ? 'text-primary dark:text-primary-light'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        ]"
        aria-label="More pages"
        aria-haspopup="dialog"
        :aria-expanded="showMoreMenu"
      >
        <Menu class="h-6 w-6 mb-0.5 shrink-0" />
        <span class="w-full truncate text-center text-[11px] font-medium leading-tight">More</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
/* The backdrop fades while the panel inside it slides, so the two read as one
   sheet rising rather than a box appearing. */
.more-sheet-enter-active,
.more-sheet-leave-active {
  transition: opacity 0.2s ease;
}

.more-sheet-enter-from,
.more-sheet-leave-to {
  opacity: 0;
}

.more-sheet-enter-active .more-sheet-panel,
.more-sheet-leave-active .more-sheet-panel {
  transition: transform 0.25s ease;
}

.more-sheet-enter-from .more-sheet-panel,
.more-sheet-leave-to .more-sheet-panel {
  transform: translateY(100%);
}
</style>
