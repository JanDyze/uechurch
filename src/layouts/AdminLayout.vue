<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
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

// Focus routes drop the chrome. Between the top bar, the bottom bar and this
// layout's padding, roughly 140px of a phone screen goes to navigation — a
// fifth of the viewport, which matters when the page is a swipe deck or a
// long form.
//
// Opt-in per route rather than blanket for detail pages, because the two are
// different animals: a task has a beginning and an end and should not offer
// ways to wander off mid-way, while a page you are reading and browsing from
// still wants its navigation. A focus route must carry its own way back, or
// it strands whoever opens it.
const route = useRoute()
const isFocus = computed(() => Boolean(route.meta?.focus))
</script>

<template>
  <div class="flex h-dvh bg-gray-50 dark:bg-gray-900 print-root">
    <!-- Sidebar - Desktop only -->
    <Sidebar />

    <!-- Main content area -->
    <div class="flex-1 min-w-0 flex flex-col overflow-hidden lg:ml-0 print-main">
      <!-- Topbar -->
      <Topbar v-if="!isFocus" />

      <!-- Main content -->
      <main
        :class="[
          'flex-1 overflow-hidden bg-white dark:bg-gray-900 print-main',
          isFocus ? '' : 'pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0',
        ]"
      >
        <!-- A focus route gets the raw box and handles its own padding and
             safe areas: the deck should reach the edges of the screen. -->
        <div :class="['h-full print-main', isFocus ? '' : 'p-3 sm:p-4 lg:px-8 lg:py-3']">
          <router-view />
        </div>
      </main>
    </div>

    <!-- People rail - wide screens; a drawer everywhere else. A focus route
         is a task, so the live presence list sits it out too. -->
    <RightSidebar v-if="!isFocus" />

    <!-- Bottom Bar - Mobile only -->
    <BottomBar v-if="!isFocus" />
  </div>
</template>

<style scoped>
/* Layout styles handled by Tailwind */
</style>
