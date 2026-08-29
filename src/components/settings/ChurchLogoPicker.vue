<script setup>
import { ref } from 'vue'
import { ImagePlus, Loader2, RotateCcw } from 'lucide-vue-next'
import { compressImageToBase64, LOGO_OPTIONS } from '../../utils/imageUtils'
import { useAppSettings } from '../../composables/useAppSettings'
import { useToast } from '../../composables/useToast'

const toast = useToast()
const { logoUrl, hasCustomLogo, saveLogo } = useAppSettings()

const fileInput = ref(null)
const busy = ref(false)

const pick = () => {
  if (busy.value) return
  fileInput.value?.click()
}

const handleFile = async (event) => {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  busy.value = true
  try {
    // Re-encoded as webp, which keeps the transparency a logo usually needs.
    await saveLogo(await compressImageToBase64(file, LOGO_OPTIONS))
    toast.success('Logo updated')
  } catch (error) {
    console.error('Error saving the church logo:', error)
    toast.error('Could not save that image. Try a smaller PNG or JPG.')
  } finally {
    busy.value = false
  }
}

const revert = async () => {
  busy.value = true
  try {
    await saveLogo('')
    toast.success('Back to the built-in logo')
  } catch (error) {
    console.error('Error clearing the church logo:', error)
    toast.error('Could not reset the logo.')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Logo</label>

    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleFile" />

    <!-- Shown on both grounds: a dark-ink logo is invisible in dark mode, and
         this is the only place anyone would notice before everyone else does. -->
    <div class="grid grid-cols-2 gap-2">
      <div
        v-for="ground in [
          { key: 'light', box: 'bg-white border-gray-200', label: 'Light mode' },
          { key: 'dark', box: 'bg-gray-900 border-gray-700', label: 'Dark mode' },
        ]"
        :key="ground.key"
        :class="['flex flex-col items-center justify-center gap-2 rounded-lg border p-3', ground.box]"
      >
        <img :src="logoUrl" alt="" class="h-12 w-auto max-w-full object-contain" />
        <span class="text-[10px] font-medium uppercase tracking-wide text-gray-400">
          {{ ground.label }}
        </span>
      </div>
    </div>

    <div class="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        @click="pick"
        :disabled="busy"
        class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:border-primary hover:text-primary dark:hover:text-primary-light transition-colors disabled:opacity-50"
      >
        <Loader2 v-if="busy" class="h-4 w-4 animate-spin" />
        <ImagePlus v-else class="h-4 w-4" />
        {{ hasCustomLogo ? 'Replace logo' : 'Upload logo' }}
      </button>

      <button
        v-if="hasCustomLogo"
        type="button"
        @click="revert"
        :disabled="busy"
        class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
      >
        <RotateCcw class="h-4 w-4" />
        Reset
      </button>
    </div>

    <p class="mt-1 text-[11px] text-gray-400">
      Sidebar, sign-in screen, browser tab and printed forms. A PNG with a
      transparent background works best; it is resized and saved automatically.
    </p>
  </div>
</template>
