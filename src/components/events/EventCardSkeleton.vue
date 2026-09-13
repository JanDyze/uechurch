<script setup>
// Stands in for EventListItem while the calendar loads, at the same size, so
// the list does not jump when the rows arrive.
</script>

<template>
  <div class="flex items-center gap-3 p-3">
    <div class="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-600"></div>
    <div class="min-w-0 flex-1 space-y-2">
      <div class="h-4 w-3/5 animate-pulse rounded bg-gray-200 dark:bg-gray-600"></div>
      <div class="h-3 w-2/5 animate-pulse rounded bg-gray-200 dark:bg-gray-600"></div>
    </div>
  </div>
</template>
