<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Home,
  Users,
  Calendar,
  Menu,
  X,
  FileText,
  ClipboardCheck,
  Heart,
  Image,
  Link2,
  DollarSign,
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const showMoreMenu = ref(false)

const primaryNav = [
  { name: 'Dashboard', path: '/', icon: Home },
  { name: 'Members', path: '/members', icon: Users },
  { name: 'Events', path: '/events', icon: Calendar },
]

const moreNav = [
  { name: 'Minutes', path: '/minutes', icon: FileText },
  { name: 'Attendance', path: '/attendance', icon: ClipboardCheck },
  { name: 'Prayer Concerns', path: '/prayer-concerns', icon: Heart },
  { name: 'Gallery', path: '/gallery', icon: Image },
  { name: 'Links', path: '/links', icon: Link2 },
  { name: 'Finances', path: '/finances', icon: DollarSign },
]

const isActive = (path) => {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}

const isMoreActive = computed(() => moreNav.some((item) => isActive(item.path)))

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
</script>

<template>
  <!-- More menu overlay -->
  <Transition name="more-menu">
    <div
      v-if="showMoreMenu"
      class="lg:hidden fixed inset-0 z-[55] bg-black/40"
      @click="closeMoreMenu"
    />
  </Transition>

  <!-- More menu sheet -->
  <Transition name="more-sheet">
    <div
      v-if="showMoreMenu"
      class="lg:hidden fixed bottom-16 left-0 right-0 z-[56] bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-t-2xl shadow-2xl max-h-[70vh] overflow-y-auto"
    >
      <div class="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-2xl">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">More Pages</h3>
        <button
          @click="closeMoreMenu"
          class="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Close menu"
        >
          <X class="h-5 w-5" />
        </button>
      </div>
      <nav class="p-2 pb-4 grid grid-cols-2 gap-1">
        <button
          v-for="item in moreNav"
          :key="item.name"
          @click="navigate(item.path)"
          :class="[
            'flex items-center gap-3 p-3 rounded-xl text-left transition-colors',
            isActive(item.path)
              ? 'bg-primary/10 text-primary dark:text-primary-light'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
          ]"
        >
          <component :is="item.icon" class="h-5 w-5 shrink-0" />
          <span class="text-sm font-medium">{{ item.name }}</span>
        </button>
      </nav>
    </div>
  </Transition>

  <nav class="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50">
    <div class="flex items-center justify-around h-16">
      <button
        v-for="item in primaryNav"
        :key="item.name"
        @click="navigate(item.path)"
        :class="[
          'flex flex-col items-center justify-center flex-1 h-full transition-colors',
          isActive(item.path)
            ? 'text-primary dark:text-primary-light'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        ]"
      >
        <component :is="item.icon" class="h-6 w-6 mb-1" />
        <span class="text-xs font-medium">{{ item.name }}</span>
      </button>

      <button
        @click="toggleMoreMenu"
        :class="[
          'flex flex-col items-center justify-center flex-1 h-full transition-colors',
          showMoreMenu || isMoreActive
            ? 'text-primary dark:text-primary-light'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        ]"
        aria-label="More pages"
      >
        <Menu class="h-6 w-6 mb-1" />
        <span class="text-xs font-medium">More</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.more-menu-enter-active,
.more-menu-leave-active {
  transition: opacity 0.2s ease;
}

.more-menu-enter-from,
.more-menu-leave-to {
  opacity: 0;
}

.more-sheet-enter-active,
.more-sheet-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.more-sheet-enter-from,
.more-sheet-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
