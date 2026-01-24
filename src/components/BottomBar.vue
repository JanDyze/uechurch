<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Home, Users, Calendar, MoreHorizontal, Facebook, FileText } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const navigation = [
  { name: 'Dashboard', path: '/', icon: Home },
  { name: 'Members', path: '/members', icon: Users },
  { name: 'Events', path: '/events', icon: Calendar },
  { name: 'Minutes', path: '/minutes', icon: FileText },
  { name: 'More', path: '/more', icon: MoreHorizontal },
]

const isActive = (path) => {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}

const navigate = (path) => {
  router.push(path)
}
</script>

<template>
  <nav class="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50">
    <div class="flex items-center justify-around h-16">
      <button
        v-for="item in navigation.slice(0, 4)"
        :key="item.name"
        @click="navigate(item.path)"
        :class="[
          'flex flex-col items-center justify-center flex-1 h-full transition-colors',
          isActive(item.path)
            ? 'text-[#01779b] dark:text-[#22b8cf]'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        ]"
      >
        <component :is="item.icon" class="h-6 w-6 mb-1" />
        <span class="text-xs font-medium">{{ item.name }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
/* Additional styles if needed */
</style>

