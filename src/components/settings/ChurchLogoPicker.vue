<script setup>
import { ref } from 'vue'
import { ImagePlus, Loader2, RotateCcw } from '../../icons'
import { compressImageToBase64, LOGO_OPTIONS } from '../../utils/imageUtils'
import { useAppSettings } from '../../composables/useAppSettings'
import { useToast } from '../../composables/useToast'

const toast = useToast()
const { church, lightLogoUrl, darkLogoUrl, hasCustomLogo, saveLogo, saveLogoDark } = useAppSettings()

const lightInput = ref(null)
const darkInput = ref(null)
const busy = ref(null)

const pick = (mode) => {
  if (busy.value) return
  if (mode === 'dark') darkInput.value?.click()
  else lightInput.value?.click()
}

const handleFile = async (mode, event) => {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  busy.value = mode
  try {
    const compressed = await compressImageToBase64(file, LOGO_OPTIONS)
    if (mode === 'dark') {
      await saveLogoDark(compressed)
      toast.success('Dark-mode logo updated')
    } else {
      await saveLogo(compressed)
      toast.success('Light-mode logo updated')
    }
  } catch (error) {
    console.error(`Error saving the ${mode} logo:`, error)
    toast.error('Could not save that image. Try a smaller PNG or JPG.')
  } finally {
    busy.value = null
  }
}

const revert = async (mode) => {
  busy.value = mode
  try {
    if (mode === 'dark') {
      await saveLogoDark('')
      toast.success('Dark-mode logo reset to the main logo')
    } else {
      await saveLogo('')
      toast.success('Light-mode logo reset to the built-in logo')
    }
  } catch (error) {
    console.error(`Error clearing the ${mode} logo:`, error)
    toast.error('Could not reset the logo.')
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <div>
    <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Logo</label>

    <div class="grid grid-cols-2 gap-2">
      <div class="flex flex-col items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white p-3">
        <img :src="lightLogoUrl" alt="" class="h-12 w-auto max-w-full object-contain" />
        <span class="text-[10px] font-medium uppercase tracking-wide text-gray-400">Light mode</span>
        <input ref="lightInput" type="file" accept="image/*" class="hidden" @change="handleFile('light', $event)" />
        <button
          type="button"
          @click="pick('light')"
          :disabled="busy !== null"
          class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-1 text-[10px] font-semibold text-gray-700 dark:text-gray-200 hover:border-primary hover:text-primary dark:hover:text-primary-light transition-colors disabled:opacity-50"
        >
          <Loader2 v-if="busy === 'light'" class="h-3.5 w-3.5 animate-spin" />
          <ImagePlus v-else class="h-3.5 w-3.5" />
          {{ hasCustomLogo ? 'Replace' : 'Upload' }}
        </button>
        <button
          v-if="hasCustomLogo"
          type="button"
          @click="revert('light')"
          :disabled="busy !== null"
          class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
        >
          <RotateCcw class="h-3 w-3" />
          Reset
        </button>
      </div>

      <div class="flex flex-col items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-900 p-3">
        <img :src="darkLogoUrl" alt="" class="h-12 w-auto max-w-full object-contain" />
        <span class="text-[10px] font-medium uppercase tracking-wide text-gray-400">Dark mode</span>
        <input ref="darkInput" type="file" accept="image/*" class="hidden" @change="handleFile('dark', $event)" />
        <button
          type="button"
          @click="pick('dark')"
          :disabled="busy !== null"
          class="inline-flex items-center gap-1.5 rounded-lg border border-gray-600 px-2 py-1 text-[10px] font-semibold text-gray-200 hover:border-primary hover:text-primary-light transition-colors disabled:opacity-50"
        >
          <Loader2 v-if="busy === 'dark'" class="h-3.5 w-3.5 animate-spin" />
          <ImagePlus v-else class="h-3.5 w-3.5" />
          {{ church.logoDark ? 'Replace' : 'Upload' }}
        </button>
        <button
          v-if="church.logoDark"
          type="button"
          @click="revert('dark')"
          :disabled="busy !== null"
          class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
        >
          <RotateCcw class="h-3 w-3" />
          Reset
        </button>
      </div>
    </div>

    <p class="mt-2 text-[11px] text-gray-400">
      The app switches between the light and dark logos automatically when the theme changes.
      A PNG with a transparent background works best; it is resized and saved automatically.
    </p>
  </div>
</template>
