<script setup>
import { computed, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Users, X } from 'lucide-vue-next'
import { usePresence } from '../composables/usePresence'
import { useAuth } from '../composables/useAuth'
import { useFocusTrap } from '../composables/useFocusTrap'
import { useMediaQuery } from '../composables/useMediaQuery'
import { getAccountAvatarUrl } from '../utils/memberUtils'
import ActivePeopleList from './people/ActivePeopleList.vue'

// The people rail. On a wide screen it is a permanent right-hand column, the
// way Facebook keeps its contacts list; anywhere narrower it collapses into a
// drawer opened from the Topbar, since the content column needs the width more
// than the rail does.
const { visitors, onlineCount, showPeoplePanel, isRailCollapsed, toggleRail } = usePresence()
const { displayName, avatarUrl } = useAuth()

// Collapsed, the rail is a strip of faces. Past a handful it would run off the
// bottom of a laptop screen, so the rest are counted instead.
const STRIP_LIMIT = 6
const stripVisitors = computed(() => visitors.value.slice(0, STRIP_LIMIT))
const stripOverflow = computed(() => Math.max(0, visitors.value.length - STRIP_LIMIT))

const visitorAvatar = (visitor) =>
  getAccountAvatarUrl({ photoURL: visitor.photoURL, uid: visitor.uid || visitor.id })

const drawerRef = ref(null)
useFocusTrap(drawerRef, showPeoplePanel, () => {
  showPeoplePanel.value = false
})

// A drawer left open behind the breakpoint would be invisible but still
// trapping focus, so close it the moment the permanent rail takes over.
const railIsVisible = useMediaQuery('(min-width: 1280px)')
watch(railIsVisible, (visible) => {
  if (visible) showPeoplePanel.value = false
})
</script>

<template>
  <!-- Permanent rail — wide screens only -->
  <aside
    :class="[
      'hidden xl:flex xl:flex-col shrink-0 bg-white dark:bg-slate-950 border-l border-gray-200 dark:border-slate-800 transition-all duration-300 no-print',
      isRailCollapsed ? 'w-16' : 'w-72',
    ]"
  >
    <div
      class="shrink-0 flex items-center gap-2 h-16 px-3 border-b border-gray-100 dark:border-slate-900"
    >
      <template v-if="!isRailCollapsed">
        <Users class="h-4 w-4 shrink-0 text-primary dark:text-primary-light" />
        <h2 class="flex-1 text-sm font-bold text-gray-900 dark:text-white">People</h2>
        <span
          class="flex items-center gap-1.5 text-xs font-semibold text-gray-400 dark:text-slate-500"
        >
          <span class="h-2 w-2 rounded-full bg-emerald-500" />
          {{ onlineCount + 1 }}
        </span>
      </template>

      <button
        @click="toggleRail"
        :class="[
          'flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-white/5 transition-colors',
          isRailCollapsed ? 'mx-auto' : '',
        ]"
        :title="isRailCollapsed ? 'Show people' : 'Hide people'"
        :aria-label="isRailCollapsed ? 'Show people' : 'Hide people'"
        :aria-expanded="!isRailCollapsed"
      >
        <ChevronLeft v-if="isRailCollapsed" class="h-4 w-4" />
        <ChevronRight v-else class="h-4 w-4" />
      </button>
    </div>

    <ActivePeopleList v-if="!isRailCollapsed" class="flex-1 min-h-0" />

    <!-- Collapsed: faces only, still live -->
    <div v-else class="flex-1 min-h-0 overflow-y-auto no-scrollbar py-3">
      <button
        @click="toggleRail"
        class="w-full flex justify-center py-1.5"
        :title="`${displayName} (you)`"
        :aria-label="`${displayName} (you). Show people`"
      >
        <span class="relative">
          <img
            :src="avatarUrl"
            alt=""
            class="h-9 w-9 rounded-full object-cover bg-gray-100 dark:bg-slate-800 ring-2 ring-primary"
          />
          <span
            class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950"
          />
        </span>
      </button>

      <button
        v-for="visitor in stripVisitors"
        :key="visitor.id"
        @click="toggleRail"
        class="w-full flex justify-center py-1.5"
        :title="visitor.name || 'Someone'"
        :aria-label="`${visitor.name || 'Someone'} is active now. Show people`"
      >
        <span class="relative">
          <img
            :src="visitorAvatar(visitor)"
            alt=""
            class="h-9 w-9 rounded-full object-cover bg-gray-100 dark:bg-slate-800"
          />
          <span
            class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950"
          />
        </span>
      </button>

      <button
        v-if="stripOverflow"
        @click="toggleRail"
        class="w-full flex justify-center py-1.5"
        :aria-label="`${stripOverflow} more people active. Show people`"
      >
        <span
          class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800 text-xs font-bold text-gray-500 dark:text-slate-400"
        >
          +{{ stripOverflow }}
        </span>
      </button>
    </div>
  </aside>

  <!-- Drawer — phones, tablets and narrow laptops -->
  <Teleport to="body">
    <Transition name="people-drawer">
      <div v-if="showPeoplePanel" class="xl:hidden fixed inset-0 z-90 no-print">
        <div class="absolute inset-0 bg-black/50" @click="showPeoplePanel = false" />

        <div
          ref="drawerRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="people-drawer-title"
          tabindex="-1"
          class="people-panel absolute inset-y-0 right-0 w-[19rem] max-w-[85vw] flex flex-col bg-white dark:bg-slate-950 shadow-2xl border-l border-gray-200 dark:border-slate-800"
        >
          <div
            class="shrink-0 flex items-center gap-2 h-16 px-4 border-b border-gray-100 dark:border-slate-900 pt-[env(safe-area-inset-top)]"
          >
            <Users class="h-4 w-4 text-primary dark:text-primary-light" />
            <h2
              id="people-drawer-title"
              class="flex-1 text-sm font-bold text-gray-900 dark:text-white"
            >
              People
            </h2>
            <span
              class="flex items-center gap-1.5 text-xs font-semibold text-gray-400 dark:text-slate-500"
            >
              <span class="h-2 w-2 rounded-full bg-emerald-500" />
              {{ onlineCount + 1 }}
            </span>
            <button
              @click="showPeoplePanel = false"
              class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              aria-label="Close"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <ActivePeopleList
            class="flex-1 min-h-0 pb-[env(safe-area-inset-bottom)]"
            @navigate="showPeoplePanel = false"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.people-drawer-enter-active,
.people-drawer-leave-active {
  transition: opacity 0.25s ease;
}

.people-drawer-enter-active .people-panel,
.people-drawer-leave-active .people-panel {
  transition: transform 0.25s ease;
}

.people-drawer-enter-from,
.people-drawer-leave-to {
  opacity: 0;
}

.people-drawer-enter-from .people-panel,
.people-drawer-leave-to .people-panel {
  transform: translateX(100%);
}
</style>
