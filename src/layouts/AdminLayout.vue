<script setup>
import { onMounted, onUnmounted } from 'vue'
import Topbar from '../components/Topbar.vue'
import Sidebar from '../components/Sidebar.vue'
import RightSidebar from '../components/RightSidebar.vue'
import BottomBar from '../components/BottomBar.vue'
import { initPresence, stopPresence } from '../composables/usePresence'

// The heartbeat belongs to the signed-in shell rather than to any one panel:
// this layout only exists while someone is authenticated, and unmounting it
// (signing out) is exactly when the presence record should disappear.
onMounted(initPresence)
onUnmounted(stopPresence)
</script>

<template>
  <div class="flex h-dvh bg-gray-50 dark:bg-gray-900 print-root">
    <!-- Sidebar - Desktop only -->
    <Sidebar />

    <!-- Main content area -->
    <div class="flex-1 min-w-0 flex flex-col overflow-hidden lg:ml-0 print-main">
      <!-- Topbar -->
      <Topbar />

      <!-- Main content -->
      <main class="flex-1 overflow-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0 bg-white dark:bg-gray-900 print-main">
        <div class="h-full p-3 sm:p-4 lg:px-8 lg:py-3 print-main">
          <router-view />
        </div>
      </main>
    </div>

    <!-- People rail - wide screens; a drawer everywhere else -->
    <RightSidebar />

    <!-- Bottom Bar - Mobile only -->
    <BottomBar />
  </div>
</template>

<style scoped>
/* Layout styles handled by Tailwind */
</style>
