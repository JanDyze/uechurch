<script setup>
import { ref } from 'vue'
import { Plus } from '../../icons'
import SearchBar from '../common/SearchBar.vue'
import { usePermissions } from '../../composables/usePermissions'

const { canManage } = usePermissions()

defineProps({
  searchQuery: {
    type: String,
    default: '',
  },
  /** 'mine' | 'all' — a scope, not a filter: the two are read differently. */
  scope: {
    type: String,
    default: 'all',
  },
  /** Hidden when the account has no member record to be assigned against. */
  showScope: {
    type: Boolean,
    default: false,
  },
  showAddTask: {
    type: Boolean,
    default: false,
  },
  mineCount: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits(['update:searchQuery', 'update:scope', 'newTask'])

const mobileSearchOpen = ref(false)
</script>

<template>
  <div class="sticky top-0 z-40 mb-3 shrink-0 rounded-xl border border-gray-200/80 bg-white/95 px-2 py-2 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 sm:px-3">
    <div class="flex w-full flex-nowrap items-center justify-between gap-2">
      <SearchBar
        :model-value="searchQuery"
        @update:model-value="emit('update:searchQuery', $event)"
        v-model:open="mobileSearchOpen"
        placeholder="Search tasks, people, ministries..."
      />

      <div
        :class="[
          'ml-auto flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2',
          mobileSearchOpen ? 'hidden lg:flex' : 'flex'
        ]"
      >
        <!-- Mine / Everyone. Two states, so it stays a segment rather than
             growing into the filter drawer this page deliberately does not
             have — everything else you might narrow by is typed in the box. -->
        <div
          v-if="showScope"
          class="flex h-10 shrink-0 items-center rounded-lg bg-gray-100 p-0.5 dark:bg-gray-700"
          role="group"
          aria-label="Whose tasks to show"
        >
          <button
            @click="emit('update:scope', 'mine')"
            :class="[
              'flex h-9 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors sm:text-sm',
              scope === 'mine'
                ? 'bg-white text-primary shadow-sm dark:bg-gray-800 dark:text-primary-light'
                : 'text-gray-500 dark:text-gray-400'
            ]"
            :aria-pressed="scope === 'mine'"
          >
            Mine
            <span
              v-if="mineCount"
              :class="[
                'rounded-full px-1.5 text-[10px] font-bold leading-4',
                scope === 'mine' ? 'bg-primary text-white' : 'bg-gray-300 text-gray-700 dark:bg-gray-600 dark:text-gray-200'
              ]"
            >{{ mineCount }}</span>
          </button>
          <button
            @click="emit('update:scope', 'all')"
            :class="[
              'h-9 rounded-md px-2.5 text-xs font-medium transition-colors sm:text-sm',
              scope === 'all'
                ? 'bg-white text-primary shadow-sm dark:bg-gray-800 dark:text-primary-light'
                : 'text-gray-500 dark:text-gray-400'
            ]"
            :aria-pressed="scope === 'all'"
          >
            Everyone
          </button>
        </div>

        <button
          v-if="canManage('tasks')"
          @click="emit('newTask')"
          class="flex h-10 shrink-0 items-center justify-center gap-1 rounded-lg bg-primary px-2.5 text-white shadow-sm transition-colors hover:bg-primary-hover dark:bg-primary dark:hover:bg-primary-hover sm:gap-1.5 sm:px-4"
          :class="{ 'bg-primary-hover dark:bg-primary-hover': showAddTask }"
          :title="showAddTask ? 'Close the task editor' : 'Add a task with details'"
        >
          <Plus
            class="h-5 w-5 shrink-0 transition-transform duration-300"
            :class="showAddTask ? 'rotate-45' : 'rotate-0'"
          />
          <span class="whitespace-nowrap text-xs sm:text-sm">Add</span>
        </button>
      </div>
    </div>
  </div>
</template>
