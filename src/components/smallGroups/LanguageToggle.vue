<script setup>
import { useSgLanguage } from '../../composables/useSgLanguage'

const { lang, languages, setLang } = useSgLanguage()
</script>

<template>
  <div
    class="inline-flex items-center gap-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5 no-print"
    role="group"
    aria-label="Form language"
  >
    <button
      v-for="option in languages"
      :key="option.code"
      type="button"
      @click="setLang(option.code)"
      :class="[
        'px-3 py-1.5 text-xs font-bold rounded-md transition-colors min-w-[46px]',
        lang === option.code
          ? 'bg-primary text-white shadow-sm'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
      ]"
      :aria-pressed="lang === option.code"
      :title="option.label"
    >
      {{ option.short }}
    </button>
  </div>
</template>
