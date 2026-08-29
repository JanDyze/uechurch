<script setup>
import { useRoute, useRouter } from 'vue-router'
import {
  Home,
  Users,
  UsersRound,
  Calendar,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  FileText,
  ClipboardCheck,
  Heart,
  Image,
  Link2,
  ListMusic,
  Mic2,
  Settings,
  UserCog
} from '../icons'
import { computed, ref } from 'vue'
import { usePermissions } from '../composables/usePermissions'
import { useAppSettings } from '../composables/useAppSettings'

const route = useRoute()
const router = useRouter()
const { can, isAdmin } = usePermissions()
const { church, logoUrl } = useAppSettings()
const isMinimized = ref(false)
const isHovered = ref(false)

// Grouped rather than a flat list of twelve. Group headers are cosmetic — the
// capability filter runs per item, and any group left with nothing in it is
// dropped entirely, so an untagged member never sees an empty heading.
const NAV_GROUPS = [
  {
    key: 'overview',
    label: '',
    items: [{ name: 'Dashboard', path: '/dashboard', icon: Home, capability: 'dashboard.view' }],
  },
  {
    key: 'people',
    label: 'People',
    items: [
      { name: 'Members', path: '/members', icon: Users, capability: 'members.view' },
      { name: 'Small Groups', path: '/small-groups', icon: UsersRound, capability: 'smallgroups.view' },
      { name: 'Attendance', path: '/attendance', icon: ClipboardCheck, capability: 'attendance.view' },
    ],
  },
  {
    key: 'gatherings',
    label: 'Gatherings',
    items: [
      { name: 'Events', path: '/events', icon: Calendar, capability: 'events.view' },
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
      { name: 'Finances', path: '/finances', icon: DollarSign, capability: 'finances.view' },
      { name: 'Accounts', path: '/accounts', icon: UserCog, adminOnly: true },
      { name: 'Settings', path: '/settings', icon: Settings, adminOnly: true },
    ],
  },
]

const allowed = (item) => (item.adminOnly ? isAdmin.value : can(item.capability))

const navGroups = computed(() =>
  NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter(allowed) })).filter(
    (group) => group.items.length > 0
  )
)


const isActive = (path) => {
  if (path === '/') {
    return route.path === '/' || route.path === ''
  }
  return route.path.startsWith(path)
}

const navigate = (path) => {
  router.push(path)
}
</script>

<template>
  <aside 
    :class="[
      'group hidden lg:flex lg:flex-col relative bg-white dark:bg-slate-950 border-r border-gray-200 dark:border-slate-800 transition-all duration-300 shadow-xl dark:shadow-2xl z-50 no-print',
      isMinimized ? 'lg:w-24' : 'lg:w-72'
    ]"
    style="overflow: visible;"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Minimize Button.
         top-20 is deliberate: the button's right half sits over the main
         column, where the sticky Topbar (h-16 = 64px, z-70) paints. This aside
         is `relative z-50`, so it opens its own stacking context — the button's
         z-index is sealed inside and can never outrank the Topbar. Anything
         above 64px stays clear of it; top-8 put the button at 32-64px, fully
         inside the Topbar's band, which is what hid it. -->
    <button
      @click="isMinimized = !isMinimized"
      class="absolute right-0 top-20 z-50 w-8 h-8 rounded-full bg-white dark:bg-slate-800 text-primary dark:text-slate-300 shadow-md hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center justify-center border border-gray-200 dark:border-slate-700"
      :class="isHovered ? 'opacity-100' : 'opacity-0'"
      :style="`transform: translateX(50%); transition: opacity ${isHovered ? '0.3s' : '2s'} ease-in-out;`"
      aria-label="Toggle sidebar"
    >
      <ChevronLeft v-if="!isMinimized" class="h-4 w-4" />
      <ChevronRight v-else class="h-4 w-4" />
    </button>

    <div class="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto no-scrollbar">
      <!-- Logo/Branding -->
      <div class="flex items-center shrink-0 px-2 mb-8 overflow-hidden">
        <div class="flex items-center gap-2 min-w-0">
          <img :src="logoUrl" :alt="church.shortName" :class="['w-auto transition-all shrink-0', isMinimized ? 'h-15' : 'h-15']" />
          <div v-if="!isMinimized" class="min-w-0 overflow-hidden">
            <h2 class="text-lg font-black text-gray-900 dark:text-white whitespace-nowrap tracking-tight">{{ church.shortName }}</h2>
            <p class="text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500 whitespace-nowrap tracking-widest mt-0.5">{{ church.fullName }}</p>
          </div>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-3 space-y-4">
        <div v-for="group in navGroups" :key="group.key" class="space-y-1">
          <p
            v-if="group.label && !isMinimized"
            class="px-2.5 pb-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-600"
          >
            {{ group.label }}
          </p>
          <!-- Minimized: a hairline stands in for the heading, so the groups
               stay legible when the labels are gone. -->
          <div
            v-else-if="group.label && isMinimized"
            class="mx-auto w-6 border-t border-gray-200 dark:border-slate-800"
          />
          <button
            v-for="item in group.items"
            :key="item.name"
            @click="navigate(item.path)"
            :class="[
              'group flex items-center p-2.5 text-sm font-semibold rounded-xl w-full transition-all relative',
              isActive(item.path)
                ? 'active text-white shadow-lg shadow-primary/20 border-l-4 border-primary dark:border-primary-light'
                : 'text-gray-500 dark:text-slate-400 hover:text-primary dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 border-l-4 border-transparent hover:border-gray-300 dark:hover:border-slate-700',
              isMinimized ? 'justify-center' : ''
            ]"
            :title="isMinimized ? item.name : ''"
            :aria-label="item.name"
            :aria-current="isActive(item.path) ? 'page' : undefined"
          >
            <component :is="item.icon" :class="['shrink-0 h-6 w-6', isMinimized ? '' : 'mr-3']" />
            <span v-if="!isMinimized" class="truncate whitespace-nowrap">{{ item.name }}</span>
          </button>
        </div>
      </nav>
    </div>
  </aside>
</template>

<style scoped>
nav button {
  background-color: transparent !important;
}

nav button.active {
  background-color: #01779b !important;
}

.dark nav button.active {
  background-color: #01779b !important; /* Keep consistent or use #22b8cf if preferred */
}

nav button.active:hover {
  background-color: #015a77 !important;
}

nav button:hover:not(.active) {
  background-color: rgba(1, 119, 155, 0.05) !important;
}

.dark nav button:hover:not(.active) {
  background-color: rgba(255, 255, 255, 0.05) !important;
}
</style>