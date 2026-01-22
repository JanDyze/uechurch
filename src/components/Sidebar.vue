<script setup>
import { useRoute, useRouter } from 'vue-router'
import logo from '../assets/uec-logo.png'
import {
  Home,
  Users,
  Calendar,
  Music,
  DollarSign,
  Building2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Facebook,
  FileText,
  ClipboardCheck,
  Heart
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
  { name: 'FB Test', path: '/fb-test', icon: Facebook },
  { name: 'Sermons', path: '/sermons', icon: Music },
  { name: 'Finances', path: '/finances', icon: DollarSign },
  { name: 'Ministries', path: '/ministries', icon: Building2 },
  { name: 'Settings', path: '/settings', icon: Settings },
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
      'group hidden lg:flex lg:flex-col relative bg-[#bc1c09]/5 dark:bg-[#bc1c09]/10 border-r border-gray-200 dark:border-gray-700 transition-all duration-300',
      isMinimized ? 'lg:w-20' : 'lg:w-64'
    ]"
    style="overflow: visible;"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Minimize Button -->
    <button
      @click="isMinimized = !isMinimized"
      class="absolute right-0 top-8 z-50 w-8 h-8 rounded-full bg-white dark:bg-[#01779b] text-[#01779b] shadow-sm hover:bg-white/90 flex items-center justify-center  dark:border-gray-800"
      :class="isHovered ? 'opacity-100' : 'opacity-0'"
      :style="`transform: translateX(50%); transition: opacity ${isHovered ? '0.3s' : '2s'} ease-in-out;`"
      aria-label="Toggle sidebar"
    >
      <ChevronLeft v-if="!isMinimized" class="h-4 w-4" />
      <ChevronRight v-else class="h-4 w-4" />
    </button>

    <div class="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
      <!-- Logo/Branding -->
      <div class="flex items-center flex-shrink-0 px-2 mb-8 overflow-hidden">
        <div class="flex items-center gap-2 min-w-0">
          <img :src="logo" alt="UEC Logo" :class="['w-auto transition-all flex-shrink-0', isMinimized ? 'h-15' : 'h-15']" />
          <div v-if="!isMinimized" class="min-w-0 overflow-hidden">
            <h2 class="text-lg font-bold text-[#01779b] dark:text-[#01779b] whitespace-nowrap">UEC Canubing II</h2>
            <p class="text-xs text-[#01779b]/70 dark:text-[#01779b]/70 whitespace-nowrap">United Evangelical Church</p>
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
            'group flex items-center p-2 text-base font-medium rounded-lg w-full transition-all relative',
            isActive(item.path)
              ? 'active text-white dark:text-white font-semibold border-l-4 border-[#01779b]'
              : 'text-[#01779b] dark:text-[#01779b] border-l-4 border-transparent hover:border-[#01779b]/50',
            isMinimized ? 'justify-center' : ''
          ]"
          :title="isMinimized ? item.name : ''"
        >
          <component :is="item.icon" :class="['flex-shrink-0 h-6 w-6', isMinimized ? '' : 'mr-3']" />
          <span v-if="!isMinimized">{{ item.name }}</span>
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

nav button.active:hover {
  background-color: rgba(1, 119, 155, 0.9) !important;
}

nav button:hover:not(.active) {
  background-color: rgba(1, 119, 155, 0.1) !important;
}

@media (prefers-color-scheme: dark) {
  nav button:hover:not(.active) {
    background-color: rgba(1, 119, 155, 0.2) !important;
  }
}
</style>

