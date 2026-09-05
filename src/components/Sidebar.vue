<script setup>
import { useRoute, useRouter } from 'vue-router'
import { ChevronLeft, ChevronRight } from '../icons'
import { computed, ref } from 'vue'
import { usePermissions } from '../composables/usePermissions'
import { allowedGroups } from '../data/navigation'
import { useAppSettings } from '../composables/useAppSettings'

const route = useRoute()
const router = useRouter()
const { can, isAdmin } = usePermissions()
const { church, logoUrl } = useAppSettings()
const isMinimized = ref(false)
const isHovered = ref(false)

const navGroups = computed(() =>
  allowedGroups(can, isAdmin.value).filter(
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
      <!-- Logo/Branding. Also the way back to the catalogue, which is not in
           the nav list below because it would then have to list itself. -->
      <button
        type="button"
        @click="navigate('/home')"
        aria-label="Home"
        class="flex items-center justify-center shrink-0 px-2 mb-8 overflow-hidden w-full"
      >
        <img :src="logoUrl" :alt="church.shortName" class="h-15 w-auto shrink-0" />
        <!-- The wordmark collapses by max-width instead of v-if, so it narrows
             and fades over the same 300ms the aside spends resizing. flex-1
             makes it fill the row while expanded, which keeps the parent's
             justify-center a no-op until the text is actually gone -- that is
             what stops the logo from snapping to centre on the first frame. -->
        <div
          class="flex-1 min-w-0 overflow-hidden transition-all duration-300 ease-in-out"
          :class="isMinimized ? 'max-w-0 opacity-0 ml-0' : 'max-w-[240px] opacity-100 ml-2'"
          :aria-hidden="isMinimized"
        >
          <h2 class="text-lg font-black text-gray-900 dark:text-white whitespace-nowrap tracking-tight">{{ church.shortName }}</h2>
          <p class="text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500 whitespace-nowrap tracking-widest mt-0.5">{{ church.fullName }}</p>
        </div>
      </button>

      <!-- Navigation -->
      <nav class="flex-1 px-3 space-y-4">
        <div v-for="group in navGroups" :key="group.key" class="space-y-1">
          <!-- Minimized: a hairline stands in for the heading, so the groups
               stay legible when the labels are gone. The two share one slot and
               cross-fade rather than swapping via v-if/v-else, so collapsing
               never reflows the group spacing mid-animation: the <p> holds the
               natural height in both states and the hairline is an overlay. -->
          <div v-if="group.label" class="relative px-2.5 pb-0.5">
            <p
              class="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-600 whitespace-nowrap overflow-hidden transition-opacity duration-300 ease-in-out"
              :class="isMinimized ? 'opacity-0' : 'opacity-100'"
            >
              {{ group.label }}
            </p>
            <div
              class="pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-300 ease-in-out"
              :class="isMinimized ? 'opacity-100' : 'opacity-0'"
              aria-hidden="true"
            >
              <div class="w-6 border-t border-gray-200 dark:border-slate-800"></div>
            </div>
          </div>
          <button
            v-for="item in group.items"
            :key="item.name"
            @click="navigate(item.path)"
            :class="[
              'group flex items-center justify-center p-2.5 text-sm font-semibold rounded-xl w-full transition-all relative',
              isActive(item.path)
                ? 'active text-white shadow-lg shadow-primary/20 border-l-4 border-primary dark:border-primary-light'
                : 'text-gray-500 dark:text-slate-400 hover:text-primary dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 border-l-4 border-transparent hover:border-gray-300 dark:hover:border-slate-700'
            ]"
            :title="isMinimized ? item.name : ''"
            :aria-label="item.name"
            :aria-current="isActive(item.path) ? 'page' : undefined"
          >
            <!-- Bare, like the glyph it stands in for: the row carries its own
                 background, so the artwork needs no plate of its own. -->
            <img
              v-if="item.image"
              :src="item.image"
              alt=""
              :class="[
                'shrink-0 h-6 w-6 object-contain transition-all duration-300 ease-in-out',
                isMinimized ? 'mr-0' : 'mr-3',
              ]"
            />
            <component
              v-else
              :is="item.icon"
              :class="['shrink-0 h-6 w-6 transition-all duration-300 ease-in-out', isMinimized ? 'mr-0' : 'mr-3']"
            />
            <!-- text-left because a <button> centres its text by default, and
                 flex-1 hands this span the whole remaining row. -->
            <span
              class="flex-1 min-w-0 text-left truncate whitespace-nowrap transition-all duration-300 ease-in-out"
              :class="isMinimized ? 'max-w-0 opacity-0' : 'max-w-[240px] opacity-100'"
            >{{ item.name }}</span>
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