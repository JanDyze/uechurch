<script setup>
// One app in the drawer's grid. Extracted because the drawer draws it in three
// places now — the dock, everything below it, and the search results — and
// three copies of a tile is how the two navs drifted apart in the first place.
defineProps({
  item: { type: Object, required: true },
  active: { type: Boolean, default: false },
})
</script>

<template>
  <button
    type="button"
    :aria-current="active ? 'page' : undefined"
    class="flex w-full flex-col items-center gap-1.5 rounded-xl px-0.5 py-0.5 transition-colors active:bg-gray-100 dark:active:bg-gray-700/50"
  >
    <span
      :class="[
        'grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[1.15rem] transition-colors',
        active ? 'app-tile-active' : 'app-tile',
      ]"
    >
      <img v-if="item.image" :src="item.image" alt="" class="h-10 w-10 object-contain" />
      <component v-else :is="item.icon" class="h-7 w-7" />
    </span>
    <span
      :class="[
        'line-clamp-2 w-full text-center text-[11px] leading-tight',
        active
          ? 'font-semibold text-primary dark:text-primary-light'
          : 'font-medium text-gray-700 dark:text-gray-300',
      ]"
    >
      {{ item.name }}
    </span>
  </button>
</template>

<style scoped>
/* The tinted squircle behind an icon, and the deeper one for the page you are
   on. Scoped here now that the tile is its own component. */
.app-tile {
  background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
  color: var(--color-primary);
}

.app-tile-active {
  background-color: color-mix(in srgb, var(--color-primary) 22%, transparent);
  color: var(--color-primary);
  box-shadow:
    inset 0 0 0 2px color-mix(in srgb, var(--color-primary) 35%, transparent),
    0 8px 18px -10px var(--color-primary);
}
</style>
