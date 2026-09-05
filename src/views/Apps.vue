<script setup>
import { computed } from 'vue'
import { usePermissions } from '../composables/usePermissions'
import { useAuth } from '../composables/useAuth'
import { useAppSettings } from '../composables/useAppSettings'
import { getDisplayName } from '../utils/memberUtils'
import { allowedGroups } from '../data/navigation'

const { can, isAdmin, myMember } = usePermissions()
const { displayName } = useAuth()
const { church } = useAppSettings()

// Read from the same list the sidebar reads from, so a page added in one place
// cannot go missing from the other.
//
// Flattened, but still in the sidebar's order, so related things stay
// neighbours without each group costing a heading and a fresh row: five small
// groups made six rows of seventeen apps, where one grid makes four.
const apps = computed(() => allowedGroups(can, isAdmin.value).flatMap((group) => group.items))

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
})

const name = computed(() => getDisplayName(myMember.value) || displayName.value)
</script>

<template>
  <div class="flex h-full flex-col gap-2 overflow-y-auto">
    <div class="flex shrink-0 items-baseline gap-2">
      <h1 class="truncate text-base font-bold text-gray-900 dark:text-white">
        {{ greeting }}<template v-if="name">, {{ name }}</template>
      </h1>
      <p class="truncate text-[11px] text-gray-400 dark:text-gray-500">
        {{ church?.shortName || church?.fullName || '' }}
      </p>
    </div>

    <div
      v-if="!apps.length"
      class="rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-600"
    >
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Nothing has been shared with this account yet.
      </p>
      <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
        An administrator grants access by ministry in Settings.
      </p>
    </div>

    <!-- One grid, home-screen density. No headings: they cost a row each, and
         the order already keeps related things together. -->
    <div
      v-else
      class="grid grid-cols-5 gap-x-1 gap-y-2 sm:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12"
    >
      <router-link
        v-for="item in apps"
        :key="item.path"
        :to="item.path"
        class="group flex flex-col items-center gap-1 rounded-lg px-0.5 py-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/50"
      >
        <!-- Artwork and line icon share one tile, so a painted page and a
             plain one sit at the same weight in the grid. Tinted in light mode,
             a plain dark surface in dark mode. -->
        <span
          class="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20 dark:bg-gray-700 dark:text-primary-light dark:group-hover:bg-gray-600"
        >
          <img
            v-if="item.image"
            :src="item.image"
            alt=""
            class="h-8 w-8 object-contain"
          />
          <component v-else :is="item.icon" class="h-6 w-6" />
        </span>
        <span
          class="line-clamp-2 w-full text-center text-[10px] font-medium leading-tight text-gray-600 dark:text-gray-400"
        >
          {{ item.name }}
        </span>
      </router-link>
    </div>
  </div>
</template>
