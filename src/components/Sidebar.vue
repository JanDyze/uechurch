<script setup>
import { useRoute, useRouter } from 'vue-router'
import logo from '../assets/uec-logo.png'
import {
  Home,
  Users,
  Calendar,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  FileText,
  ClipboardCheck,
  Heart,
  Image,
  Link2
} from 'lucide-vue-next'
import { ref } from 'vue'

const route = useRoute()
const router = useRouter()
const isMinimized = ref(false)
const isHovered = ref(false)

const navigation = [
  { name: 'Dashboard', path: '/', icon: Home },
  { name: 'Members', path: '/members', icon: Users },
  { name: 'Events', path: '/events', icon: Calendar },
  { name: 'Minutes', path: '/minutes', icon: FileText },
  { name: 'Attendance', path: '/attendance', icon: ClipboardCheck },
  { name: 'Prayer Concerns', path: '/prayer-concerns', icon: Heart },
  { name: 'Gallery', path: '/gallery', icon: Image },
  { name: 'Links', path: '/links', icon: Link2 },
  { name: 'Finances', path: '/finances', icon: DollarSign },
]

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
      'group hidden lg:flex lg:flex-col relative bg-white dark:bg-slate-950 border-r border-gray-200 dark:border-slate-800 transition-all duration-300 shadow-xl dark:shadow-2xl z-50',
      isMinimized ? 'lg:w-24' : 'lg:w-72'
    ]"
    style="overflow: visible;"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Minimize Button -->
    <button
      @click="isMinimized = !isMinimized"
      class="absolute right-0 top-8 z-50 w-8 h-8 rounded-full bg-white dark:bg-slate-800 text-[#01779b] dark:text-slate-300 shadow-md hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center justify-center border border-gray-200 dark:border-slate-700"
      :class="isHovered ? 'opacity-100' : 'opacity-0'"
      :style="`transform: translateX(50%); transition: opacity ${isHovered ? '0.3s' : '2s'} ease-in-out;`"
      aria-label="Toggle sidebar"
    >
      <ChevronLeft v-if="!isMinimized" class="h-4 w-4" />
      <ChevronRight v-else class="h-4 w-4" />
    </button>

    <div class="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto no-scrollbar">
      <!-- Logo/Branding -->
      <div class="flex items-center flex-shrink-0 px-2 mb-8 overflow-hidden">
        <div class="flex items-center gap-2 min-w-0">
          <img :src="logo" alt="UEC Logo" :class="['w-auto transition-all flex-shrink-0 dark:brightness-0 dark:invert dark:opacity-90', isMinimized ? 'h-15' : 'h-15']" />
          <div v-if="!isMinimized" class="min-w-0 overflow-hidden">
            <h2 class="text-lg font-black text-gray-900 dark:text-white whitespace-nowrap tracking-tight">UEC Canubing II</h2>
            <p class="text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500 whitespace-nowrap tracking-widest mt-0.5">United Evangelical Church</p>
          </div>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-3 space-y-1">
        <button
          v-for="item in navigation"
          :key="item.name"
          @click="navigate(item.path)"
          :class="[
            'group flex items-center p-2.5 text-sm font-semibold rounded-xl w-full transition-all relative mt-1',
            isActive(item.path)
              ? 'active text-white shadow-lg shadow-[#01779b]/20 border-l-4 border-[#01779b] dark:border-[#22b8cf]'
              : 'text-gray-500 dark:text-slate-400 hover:text-[#01779b] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 border-l-4 border-transparent hover:border-gray-300 dark:hover:border-slate-700',
            isMinimized ? 'justify-center' : ''
          ]"
          :title="isMinimized ? item.name : ''"
        >
          <component :is="item.icon" :class="['flex-shrink-0 h-6 w-6', isMinimized ? '' : 'mr-3']" />
          <span v-if="!isMinimized" class="truncate whitespace-nowrap">{{ item.name }}</span>
        </button>
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

/* Hide scrollbar */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.no-scrollbar {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}
</style>

