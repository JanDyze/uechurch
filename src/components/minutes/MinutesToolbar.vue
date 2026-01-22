<script setup>
import { Search, Plus, FileText } from 'lucide-vue-next'

defineProps({
  searchQuery: {
    type: String,
    default: ''
  },
  showAddMinute: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:searchQuery', 'newMinute'])
</script>

<template>
  <div class="sticky top-0 z-40 mb-4 flex-shrink-0 flex items-center gap-3 bg-white dark:bg-gray-900 py-2">
    <div class="relative flex-1">
      <Search
        class="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
      />
      <input
        :value="searchQuery"
        @input="emit('update:searchQuery', $event.target.value)"
        type="text"
        placeholder="Search minutes..."
        class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
      />
    </div>

    <!-- Action Buttons -->
    <div class="flex items-center gap-2">
      <button
        @click="emit('newMinute')"
        :class="[
          'flex items-center gap-2 px-4 py-2 rounded-lg transition-all shadow-sm',
          showAddMinute
            ? 'bg-[#015a77] text-white hover:bg-[#014a60]'
            : 'bg-[#01779b] text-white hover:bg-[#015a77]'
        ]"
        :title="showAddMinute ? 'Close add minutes drawer' : 'Create new minutes'"
      >
        <Plus 
          :class="[
            'h-5 w-5 transition-transform duration-300',
            showAddMinute ? 'rotate-45' : 'rotate-0'
          ]"
        />
      </button>
    </div>
  </div>
</template>



