<script setup>
import { computed, ref, watchEffect } from 'vue'
import { getEventIcon, isIconLoaded, loadAllIconPaths } from '../../utils/eventIcons'

// A ministry's or tag's picture, at chip size. Draws nothing at all when there
// is none, so a chip without one is exactly the chip it was before.

const props = defineProps({
  mark: { type: Object, default: null },
  // Tailwind size classes for the box.
  size: { type: String, default: 'h-4 w-4' },
})

// An icon outside the common set draws as the default until the full set has
// arrived. Bumped once it has, so the right one replaces it.
const loaded = ref(0)

watchEffect(async () => {
  const icon = props.mark?.icon
  if (!icon || props.mark?.imageUrl || isIconLoaded(icon)) return
  try {
    await loadAllIconPaths()
    loaded.value += 1
  } catch {
    /* the default icon stands in */
  }
})

const iconComponent = computed(() => {
  loaded.value
  return props.mark?.icon ? getEventIcon(props.mark.icon) : null
})
</script>

<template>
  <img
    v-if="mark?.imageUrl"
    :src="mark.imageUrl"
    alt=""
    loading="lazy"
    :class="['shrink-0 rounded-full object-cover', size]"
  />
  <component
    :is="iconComponent"
    v-else-if="iconComponent"
    :key="loaded"
    aria-hidden="true"
    :class="['shrink-0', size]"
  />
</template>
