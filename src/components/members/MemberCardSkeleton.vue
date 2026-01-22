<script setup>
const props = defineProps({
  viewMode: {
    type: String,
    default: 'simple'
  }
})
</script>

<template>
  <div class="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border-2 border-transparent">
    <div v-if="viewMode === 'simple'" class="flex flex-col gap-2">
      <div class="flex items-center gap-3">
        <div class="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-600 animate-pulse"></div>
        <div class="flex-1 min-w-0 space-y-2">
          <div class="h-4 w-24 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
          <div class="h-3 w-16 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
        </div>
      </div>
    </div>
    <div v-else class="flex flex-col gap-2">
      <div class="flex items-center gap-3 mb-1">
        <div class="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-600 animate-pulse"></div>
        <div class="flex-1 min-w-0 space-y-2">
          <div class="h-4 w-32 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
        </div>
      </div>
      <div class="w-full space-y-1 pt-1 border-t border-gray-200 dark:border-gray-600">
        <div class="h-3 w-full bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
        <div class="h-3 w-3/4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
        <div class="h-3 w-1/2 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
      </div>
    </div>
  </div>
</template>



