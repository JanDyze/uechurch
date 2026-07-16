<script setup>
import { ref } from 'vue'
import { Plus, Heart } from 'lucide-vue-next'
import SearchBar from '../common/SearchBar.vue'

defineProps({
  searchQuery: {
    type: String,
    default: ''
  },
  showAddConcern: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:searchQuery', 'newConcern'])

const mobileSearchOpen = ref(false)
</script>

<template>
  <div class="sticky top-0 z-40 mb-4 shrink-0 rounded-xl border border-gray-200/80 bg-white/95 px-2 py-2 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 sm:px-3">
    <div class="flex items-center justify-between gap-2 w-full flex-nowrap">
      <SearchBar
        :model-value="searchQuery"
        @update:model-value="emit('update:searchQuery', $event)"
        v-model:open="mobileSearchOpen"
        placeholder="Search prayer concerns..."
      />

      <!-- Action Buttons -->
      <div :class="['flex items-center gap-1.5 sm:gap-2 flex-nowrap shrink-0 ml-auto', mobileSearchOpen ? 'hidden lg:flex' : 'flex']">
        <button
          @click="emit('newConcern')"
          class="flex h-10 items-center justify-center rounded-lg bg-primary text-white shadow-sm transition-colors hover:bg-primary-hover dark:bg-primary dark:hover:bg-primary-hover px-2.5 sm:px-4 gap-1.5 w-10 sm:w-auto shrink-0"
          :class="{ 'bg-primary-hover dark:bg-primary-hover': showAddConcern }"
          :title="showAddConcern ? 'Close add prayer concern drawer' : 'Add new prayer concern'"
        >
          <Plus 
            class="h-5 w-5 transition-transform duration-300 shrink-0"
            :class="showAddConcern ? 'rotate-45' : 'rotate-0'"
          />
          <span class="hidden sm:inline whitespace-nowrap">Add</span>
        </button>
      </div>
    </div>
  </div>
</template>

