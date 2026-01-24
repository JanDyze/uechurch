<script setup>
import Topbar from '../components/Topbar.vue'
import Sidebar from '../components/Sidebar.vue'
import BottomBar from '../components/BottomBar.vue'
</script>

<template>
  <div class="flex h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Sidebar - Desktop only -->
    <Sidebar />

    <!-- Main content area -->
    <div class="flex-1 flex flex-col overflow-hidden lg:ml-0">
      <!-- Topbar -->
      <Topbar />

      <!-- Main content -->
      <main class="flex-1 overflow-hidden pb-16 lg:pb-0 bg-white dark:bg-gray-900">
        <div class="h-full p-4 sm:p-6 lg:px-8 lg:py-3">
          <router-view />
        </div>
      </main>
    </div>

    <!-- Bottom Bar - Mobile only -->
    <BottomBar />
  </div>
</template>

<style scoped>
/* Layout styles handled by Tailwind */
</style>

