<script setup>
// The three stages of the discipleship process, drawn the way the church's own
// poster draws them: a seed, the tree it becomes, and the fruit it bears — in
// pixels, on a 16x16 grid, with the poster's palette.
//
// Redrawn as SVG rather than cropped out of Discipleship-Process.png because
// that file is a 1080px social graphic: lifting three icons out of it would
// mean shipping three images to render something that is forty pixels wide.
// This is a few hundred bytes, scales to any size, and inherits no background.
defineProps({
  index: { type: Number, default: 0 },
})

const SEED = '#8b5a2b'
const SEED_DARK = '#6b4423'
const SEED_LIGHT = '#c8813a'
const SEED_SHINE = '#e6b477'

const LEAF = '#6fa653'
const LEAF_DARK = '#4a7c3f'
const LEAF_LIGHT = '#8fc46a'
const TRUNK = '#7a4a24'

const GRAPE = '#8b4a9c'
const GRAPE_DARK = '#5f2d6e'
const GRAPE_LIGHT = '#b06fc4'
</script>

<template>
  <svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
    <!-- Punla — the seed, cap and all -->
    <g v-if="index === 0">
      <rect x="5" y="2" width="6" height="2" :fill="SEED_DARK" />
      <rect x="4" y="3" width="8" height="1" :fill="SEED_DARK" />
      <rect x="4" y="4" width="8" height="4" :fill="SEED" />
      <rect x="5" y="8" width="6" height="2" :fill="SEED" />
      <rect x="6" y="10" width="4" height="2" :fill="SEED_LIGHT" />
      <rect x="7" y="12" width="2" height="1" :fill="SEED_LIGHT" />
      <rect x="6" y="5" width="1" height="4" :fill="SEED_SHINE" />
      <rect x="7" y="5" width="1" height="2" :fill="SEED_SHINE" />
    </g>

    <!-- Puno — canopy over a trunk -->
    <g v-else-if="index === 1">
      <rect x="5" y="1" width="6" height="2" :fill="LEAF" />
      <rect x="3" y="3" width="10" height="3" :fill="LEAF" />
      <rect x="2" y="5" width="12" height="2" :fill="LEAF_DARK" />
      <rect x="3" y="7" width="10" height="1" :fill="LEAF_DARK" />
      <rect x="5" y="2" width="3" height="3" :fill="LEAF_LIGHT" />
      <rect x="9" y="4" width="2" height="2" :fill="LEAF_LIGHT" />
      <rect x="7" y="8" width="2" height="5" :fill="TRUNK" />
      <rect x="6" y="12" width="4" height="1" :fill="TRUNK" />
    </g>

    <!-- Prutas — the bunch, with a leaf on the stem -->
    <g v-else>
      <rect x="9" y="1" width="4" height="2" :fill="LEAF_DARK" />
      <rect x="10" y="3" width="2" height="1" :fill="LEAF_DARK" />
      <rect x="8" y="2" width="1" height="3" :fill="TRUNK" />
      <rect x="6" y="4" width="4" height="2" :fill="GRAPE" />
      <rect x="5" y="6" width="6" height="2" :fill="GRAPE" />
      <rect x="5" y="8" width="6" height="2" :fill="GRAPE_DARK" />
      <rect x="6" y="10" width="4" height="2" :fill="GRAPE_DARK" />
      <rect x="7" y="12" width="2" height="1" :fill="GRAPE_DARK" />
      <rect x="6" y="4" width="1" height="2" :fill="GRAPE_LIGHT" />
      <rect x="5" y="6" width="1" height="1" :fill="GRAPE_LIGHT" />
      <rect x="8" y="6" width="1" height="1" :fill="GRAPE_LIGHT" />
    </g>
  </svg>
</template>
