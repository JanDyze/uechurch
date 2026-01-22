<script setup>
import { X } from 'lucide-vue-next'

defineProps({
  show: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: 'Confirm Action'
  },
  message: {
    type: String,
    required: true
  },
  confirmText: {
    type: String,
    default: 'Confirm'
  },
  cancelText: {
    type: String,
    default: 'Cancel'
  },
  confirmButtonClass: {
    type: String,
    default: 'bg-[#01779b] text-white hover:bg-[#015a77]'
  }
})

const emit = defineEmits(['update:show', 'confirm', 'cancel'])

const handleConfirm = () => {
  emit('confirm')
  emit('update:show', false)
}

const handleCancel = () => {
  emit('cancel')
  emit('update:show', false)
}
</script>

<template>
  <Transition name="modal">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      @click.self="handleCancel"
    >
      <div
        class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full"
        @click.stop
      >
        <!-- Header -->
        <div class="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ title }}</h3>
          <button
            @click="handleCancel"
            class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <!-- Content -->
        <div class="px-6 py-4">
          <p class="text-gray-700 dark:text-gray-300">{{ message }}</p>
        </div>

        <!-- Footer -->
        <div class="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            v-if="cancelText"
            @click="handleCancel"
            class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {{ cancelText }}
          </button>
          <button
            @click="handleConfirm"
            :class="[
              'px-4 py-2 rounded-lg transition-colors',
              confirmButtonClass
            ]"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
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

