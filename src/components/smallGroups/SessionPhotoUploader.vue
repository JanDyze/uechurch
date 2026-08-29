<script setup>
import { ref } from 'vue'
import { ImagePlus, Trash2, Loader2 } from 'lucide-vue-next'
import { compressImageToBase64 } from '../../utils/imageUtils'
import { useSgLanguage } from '../../composables/useSgLanguage'

const props = defineProps({
  photos: { type: Array, default: () => [] },
  // Photos can only be attached once the session document exists, since each
  // photo row points back at a session id.
  disabled: { type: Boolean, default: false },
  disabledHint: { type: String, default: '' },
})

const emit = defineEmits(['upload', 'delete'])

const { t } = useSgLanguage()
const fileInput = ref(null)
const isUploading = ref(false)

const pick = () => {
  if (props.disabled || isUploading.value) return
  fileInput.value?.click()
}

const handleFiles = async (event) => {
  const files = Array.from(event.target.files || [])
  if (!files.length) return
  isUploading.value = true
  try {
    for (const file of files) {
      const base64 = await compressImageToBase64(file)
      emit('upload', base64)
    }
  } finally {
    isUploading.value = false
    event.target.value = ''
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-2">
      <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('photos') }}
      </label>
      <button
        type="button"
        @click="pick"
        :disabled="disabled || isUploading"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Loader2 v-if="isUploading" class="h-3.5 w-3.5 animate-spin" />
        <ImagePlus v-else class="h-3.5 w-3.5" />
        {{ t('add') }}
      </button>
    </div>

    <p v-if="disabled && disabledHint" class="mb-2 text-xs text-gray-500 dark:text-gray-400">
      {{ disabledHint }}
    </p>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      multiple
      class="hidden"
      @change="handleFiles"
    />

    <div v-if="photos.length" class="grid grid-cols-3 sm:grid-cols-4 gap-2">
      <div
        v-for="photo in photos"
        :key="photo.id"
        class="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
      >
        <img :src="photo.url" :alt="photo.caption || 'Session photo'" class="h-full w-full object-cover" />
        <button
          type="button"
          @click="$emit('delete', photo)"
          class="absolute top-1 right-1 p-1.5 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          aria-label="Delete photo"
        >
          <Trash2 class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    <p
      v-else-if="!disabled"
      class="text-xs text-gray-500 dark:text-gray-400 py-3 text-center rounded-lg border border-dashed border-gray-300 dark:border-gray-600"
    >
      {{ t('none') }}
    </p>
  </div>
</template>
