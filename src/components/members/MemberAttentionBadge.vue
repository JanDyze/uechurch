<script setup>
import { computed } from 'vue'
import { AlertCircle } from '../../icons'
import { missingMemberDetails, listPhrase } from '../../utils/memberUtils'

const props = defineProps({
  member: { type: Object, required: true },
})

const missing = computed(() => missingMemberDetails(props.member))

// A count, not a list. Naming every gap turned a screen of thin records into a
// wall of amber sentences and pushed the names themselves aside; a bare icon
// went the other way and said nothing at all on a phone, where there is no
// hover to reveal the tooltip. The number says how thin without spending a
// line, and the record itself now names them.
const label = computed(() => `Missing ${listPhrase(missing.value)}`)
</script>

<template>
  <span
    v-if="missing.length"
    :title="label"
    :aria-label="label"
    class="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
  >
    <AlertCircle class="h-3 w-3" />
    {{ missing.length }}
  </span>
</template>
