<script setup>
import { ref, computed } from 'vue'
import { Search, X } from 'lucide-vue-next'
import iconsData from '../../data/lucideIcons.json'
import * as LucideIcons from 'lucide-vue-next'

const props = defineProps({
  modelValue: {
    type: String,
    default: 'Calendar'
  },
  searchPlaceholder: {
    type: String,
    default: 'Search icons...'
  }
})

const emit = defineEmits(['update:modelValue'])

const searchQuery = ref('')
const showModal = ref(false)

const filteredIcons = computed(() => {
  if (!searchQuery.value.trim()) {
    return iconsData.icons
  }
  const query = searchQuery.value.toLowerCase()
  return iconsData.icons.filter(icon => 
    icon.toLowerCase().includes(query)
  )
})

const selectedIcon = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const getIconComponent = (iconName) => {
  return LucideIcons[iconName] || LucideIcons.Calendar
}

const selectIcon = (iconName) => {
  selectedIcon.value = iconName
  showModal.value = false
  searchQuery.value = ''
}

const openModal = () => {
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  searchQuery.value = ''
}
</script>

<template>
  <div class="relative">
    <!-- Selected Icon Display Button -->
    <button
      @click="openModal"
      type="button"
      class="w-full flex items-center justify-between gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:border-[#01779b] dark:hover:border-[#01779b] transition-colors"
    >
      <div class="flex items-center gap-2">
        <component :is="getIconComponent(selectedIcon)" class="h-5 w-5" />
        <span class="text-sm">{{ selectedIcon }}</span>
      </div>
    </button>

    <!-- Modal -->
    <Transition name="modal">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        @click.self="closeModal"
      >
        <div
          class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col"
        >
          <!-- Header -->
          <div class="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Select Icon</h3>
            <button
              @click="closeModal"
              class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <!-- Search Bar -->
          <div class="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
            <div class="relative">
              <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                v-model="searchQuery"
                type="text"
                :placeholder="searchPlaceholder"
                class="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
                @keydown.esc="closeModal"
                autofocus
              />
            </div>
          </div>

          <!-- Icons Grid -->
          <div class="flex-1 overflow-y-auto p-2">
            <div class="grid grid-cols-8 gap-1">
              <button
                v-for="iconName in filteredIcons"
                :key="iconName"
                @click="selectIcon(iconName)"
                :class="[
                  'aspect-square p-0.5 rounded border transition-colors flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700',
                  selectedIcon === iconName
                    ? 'border-[#01779b] bg-[#01779b]/10 dark:bg-[#01779b]/20'
                    : 'border-gray-200 dark:border-gray-700'
                ]"
                :title="iconName"
              >
                <component :is="getIconComponent(iconName)" class="h-4 w-4 text-gray-700 dark:text-gray-300 flex-shrink-0" />
              </button>
            </div>
            <div v-if="filteredIcons.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
              No icons found
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>

