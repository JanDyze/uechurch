<script setup>
import { computed } from 'vue'
import { AlertCircle } from '../../icons'
import { missingMemberDetails, listPhrase } from '../../utils/memberUtils'

const props = defineProps({
  member: { type: Object, required: true },
})

const missing = computed(() => missingMemberDetails(props.member))

// Prompts, without itemising. Naming every gap turned a screen of thin records
// into a wall of amber sentences and pushed the names themselves aside - and
// the answer is one tap away in the record. The list still rides along in the
// tooltip and the accessible name, where it costs no space.
const label = computed(() => `Missing ${listPhrase(missing.value)}`)
</script>

<template>
  <span
    v-if="missing.length"
    :title="label"
    :aria-label="label"
    role="img"
    class="inline-flex shrink-0 text-amber-500 dark:text-amber-400"
  >
    <AlertCircle class="h-3.5 w-3.5" />
  </span>
</template>
