<script setup>
import { Moon, Sun } from 'lucide-vue-next'
import { useTheme } from '../composables/useTheme'
import church from '../assets/church.jpg'
import { useAppSettings } from '../composables/useAppSettings'

const { church: churchInfo, logoUrl } = useAppSettings()

defineProps({
  title: String,
  subtitle: String,
})

const { isDark, toggleTheme } = useTheme()
</script>

<template>
  <div class="min-h-dvh flex bg-white dark:bg-gray-900">
    <!-- Brand panel — desktop only -->
    <div class="hidden lg:flex lg:w-1/2 relative overflow-hidden">
      <img :src="church" alt="" class="absolute inset-0 w-full h-full object-cover" />
      <div class="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/80 to-gray-900/90"></div>

      <div class="relative flex flex-col justify-between p-12 text-white">
        <div class="flex items-center gap-3">
          <img :src="logoUrl" :alt="churchInfo.shortName" class="h-14 w-auto" />
          <div>
            <h1 class="text-xl font-black tracking-tight">{{ churchInfo.shortName }}</h1>
            <p class="text-[10px] font-bold uppercase tracking-widest text-white/70 mt-0.5">
              {{ churchInfo.fullName }}
            </p>
          </div>
        </div>

        <div>
          <p class="text-[10px] font-black uppercase tracking-widest text-white/60 mb-3">
            Church Management System
          </p>
          <p class="text-3xl font-black leading-tight tracking-tighter max-w-md">
            Members, events, minutes and finances — all in one place.
          </p>
        </div>

        <p class="text-[10px] font-bold uppercase tracking-widest text-white/50">
          &copy; {{ new Date().getFullYear() }} {{ churchInfo.shortName }}
        </p>
      </div>
    </div>

    <!-- Form panel -->
    <div class="flex-1 flex flex-col">
      <div class="flex justify-end p-4">
        <button
          @click="toggleTheme($event)"
          class="p-2 rounded-full text-primary dark:text-primary-light hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        >
          <Sun v-if="isDark" class="w-5 h-5" />
          <Moon v-else class="w-5 h-5" />
        </button>
      </div>

      <div class="flex-1 flex items-center justify-center px-6 pb-12">
        <div class="w-full max-w-sm">
          <!-- Mobile branding -->
          <div class="flex flex-col items-center gap-2 mb-8 lg:hidden">
            <img :src="logoUrl" :alt="churchInfo.shortName" class="h-16 w-auto" />
            <h1 class="text-base font-black text-gray-900 dark:text-white tracking-tight">
              {{ churchInfo.shortName }}
            </h1>
          </div>

          <div class="mb-8">
            <p class="text-[10px] font-black uppercase tracking-widest text-primary dark:text-primary-light mb-2">
              {{ subtitle }}
            </p>
            <h2 class="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">
              {{ title }}
            </h2>
          </div>

          <slot />
        </div>
      </div>
    </div>
  </div>
</template>
