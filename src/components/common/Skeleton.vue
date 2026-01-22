<script setup>
const props = defineProps({
  width: {
    type: String,
    default: '100%'
  },
  height: {
    type: String,
    default: '1rem'
  },
  rounded: {
    type: String,
    default: 'rounded'
  },
  className: {
    type: String,
    default: ''
  }
})
</script>

<template>
  <div
    :class="[
      'animate-pulse bg-gray-200 dark:bg-gray-700',
      rounded,
      className
    ]"
    :style="{ width, height }"
  ></div>
</template>



