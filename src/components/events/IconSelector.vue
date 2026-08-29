<script setup>
import { ref, computed } from 'vue'
import { Search, X } from '../../icons'
import { useFocusTrap } from '../../composables/useFocusTrap'
import {
  EVENT_ICON_NAMES,
  DEFAULT_EVENT_ICON,
  getEventIcon as getIconComponent,
  loadAllIconPaths,
} from '../../utils/eventIcons'

const props = defineProps({
  modelValue: {
    type: String,
    default: DEFAULT_EVENT_ICON
  },
  searchPlaceholder: {
    type: String,
    default: 'Search icons...'
  }
})

const emit = defineEmits(['update:modelValue'])

const searchQuery = ref('')
const showModal = ref(false)
// Bumping this after the path data arrives re-runs the grid's render so the
// icons that were falling back are drawn properly.
const iconsReady = ref(false)

// 1500 icons is far more than a grid should mount at once, so an unfiltered
// list is capped and search is how you reach the rest.
const BROWSE_LIMIT = 300

const matchingIcons = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return EVENT_ICON_NAMES
  return EVENT_ICON_NAMES.filter((icon) => icon.toLowerCase().includes(query))
})

const filteredIcons = computed(() => matchingIcons.value.slice(0, BROWSE_LIMIT))

const hiddenCount = computed(() => matchingIcons.value.length - filteredIcons.value.length)

const selectedIcon = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const selectIcon = (iconName) => {
  selectedIcon.value = iconName
  showModal.value = false
  searchQuery.value = ''
}

// The full icon set is 644 KB of path data, so it is fetched the first time
// the picker is opened rather than shipped to everyone who never opens it.
// Until it lands the grid draws the common set and falls back for the rest,
// which is why this is not awaited before showing the modal.
const loadingIcons = ref(false)

const openModal = async () => {
  showModal.value = true
  if (iconsReady.value) return
  loadingIcons.value = true
  try {
    await loadAllIconPaths()
    iconsReady.value = true
  } catch (e) {
    console.error('Could not load the icon set:', e)
  } finally {
    loadingIcons.value = false
  }
}

const closeModal = () => {
  showModal.value = false
  searchQuery.value = ''
}

const dialogRef = ref(null)
useFocusTrap(dialogRef, showModal, closeModal)
</script>

<template>
  <div class="relative">
    <!-- Selected Icon Display Button -->
    <button
      @click="openModal"
      type="button"
      class="w-full flex items-center justify-between gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:border-primary dark:hover:border-primary transition-colors"
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
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="icon-selector-title"
          tabindex="-1"
          class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col"
        >
          <!-- Header -->
          <div class="shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 id="icon-selector-title" class="text-lg font-semibold text-gray-900 dark:text-white">Select Icon</h3>
            <button
              @click="closeModal"
              aria-label="Close"
              class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <!-- Search Bar -->
          <div class="shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
            <div class="relative">
              <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                v-model="searchQuery"
                type="text"
                :placeholder="searchPlaceholder"
                class="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                @keydown.esc="closeModal"
                autofocus
              />
            </div>
          </div>

          <!-- Icons Grid -->
          <div class="flex-1 overflow-y-auto p-2">
            <div class="grid grid-cols-5 sm:grid-cols-8 gap-1">
              <button
                v-for="iconName in filteredIcons"
                :key="iconName"
                @click="selectIcon(iconName)"
                :class="[
                  'aspect-square p-0.5 rounded border transition-colors flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700',
                  selectedIcon === iconName
                    ? 'border-primary bg-primary/10 dark:bg-primary/20'
                    : 'border-gray-200 dark:border-gray-700'
                ]"
                :title="iconName"
                :aria-label="iconName"
                :aria-pressed="selectedIcon === iconName"
              >
                <component
                  :is="getIconComponent(iconName)"
                  :key="`${iconName}-${iconsReady}`"
                  class="h-4 w-4 text-gray-700 dark:text-gray-300 shrink-0"
                />
              </button>
            </div>
            <div v-if="loadingIcons" class="text-center py-8 text-gray-500 dark:text-gray-400">
              Loading icons...
            </div>
            <div v-else-if="filteredIcons.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
              No icons found
            </div>
            <p
              v-else-if="hiddenCount > 0"
              class="py-4 text-center text-xs text-gray-400 dark:text-gray-500"
            >
              {{ hiddenCount }} more &mdash; keep typing to narrow the search
            </p>
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

