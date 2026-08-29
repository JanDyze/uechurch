<script setup>
import { ref } from 'vue'
import { ImagePlus, Loader2, Pencil, Trash2 } from '../../icons'
import {
  readImageFile,
  cropImageToBase64,
  COVER_ASPECT,
  COVER_PHOTO_OPTIONS,
} from '../../utils/imageUtils'
import { useSgLanguage } from '../../composables/useSgLanguage'
import ImageCropModal from '../common/ImageCropModal.vue'

defineProps({
  modelValue: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const { t } = useSgLanguage()
const fileInput = ref(null)
const isProcessing = ref(false)
const showCrop = ref(false)
// The decoded source stays in memory only until the crop is applied; what gets
// saved is the cropped 16:9 copy.
const sourceImage = ref(null)

const pick = () => {
  if (isProcessing.value) return
  fileInput.value?.click()
}

const handleFile = async (event) => {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  isProcessing.value = true
  try {
    sourceImage.value = await readImageFile(file)
    showCrop.value = true
  } finally {
    isProcessing.value = false
  }
}

const handleCrop = (rect) => {
  if (!sourceImage.value) return
  isProcessing.value = true
  try {
    emit(
      'update:modelValue',
      cropImageToBase64(sourceImage.value, rect, { maxSize: COVER_PHOTO_OPTIONS.maxSize })
    )
    showCrop.value = false
    sourceImage.value = null
  } finally {
    isProcessing.value = false
  }
}
</script>

<template>
  <div>
    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      {{ t('coverPhoto') }}
    </label>

    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleFile" />

    <!-- Empty: the whole 16:9 box is the target, so it is easy to hit on a phone. -->
    <button
      v-if="!modelValue"
      type="button"
      @click="pick"
      :disabled="isProcessing"
      class="w-full aspect-video rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center gap-1.5 hover:border-primary/60 hover:text-primary transition-colors disabled:opacity-60"
    >
      <Loader2 v-if="isProcessing" class="h-6 w-6 animate-spin" />
      <ImagePlus v-else class="h-6 w-6" />
      <span class="text-xs font-medium">{{ t('add') }}</span>
    </button>

    <div
      v-else
      class="relative aspect-video rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700"
    >
      <img :src="modelValue" alt="" class="h-full w-full object-cover" />
      <div
        class="absolute inset-x-0 bottom-0 p-2 flex justify-end gap-2 bg-gradient-to-t from-black/60 to-transparent"
      >
        <button
          type="button"
          @click="pick"
          :disabled="isProcessing"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/90 text-gray-800 hover:bg-white transition-colors disabled:opacity-60"
        >
          <Loader2 v-if="isProcessing" class="h-3.5 w-3.5 animate-spin" />
          <Pencil v-else class="h-3.5 w-3.5" />
          {{ t('changePhoto') }}
        </button>
        <button
          type="button"
          @click="$emit('update:modelValue', '')"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-black/60 text-white hover:bg-black/75 transition-colors"
        >
          <Trash2 class="h-3.5 w-3.5" />
          {{ t('removePhoto') }}
        </button>
      </div>
    </div>

    <ImageCropModal
      v-model:show="showCrop"
      :image="sourceImage"
      :aspect="COVER_ASPECT"
      :title="t('adjustPhoto')"
      :hint="t('adjustPhotoHint')"
      :apply-label="t('save')"
      :cancel-label="t('cancel')"
      :busy="isProcessing"
      @apply="handleCrop"
    />
  </div>
</template>
