<script setup>
import { computed } from "vue";
import { Users, UserCheck, Gift } from "../../icons";

const props = defineProps({
  stats: {
    type: Object,
    required: true,
  },
  agedTotal: {
    type: Number,
    default: 0,
  },
  birthdayMonthLabel: {
    type: String,
    default: "",
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

// Three numbers of the same kind: who we have, who is committed, and who to
// greet this month.
const tiles = computed(() => [
  {
    key: "total",
    icon: Users,
    value: props.stats.total,
    label: "People",
    hint: `${props.stats.male} male · ${props.stats.female} female`,
  },
  {
    key: "members",
    icon: UserCheck,
    value: props.stats.members,
    label: "Members",
    hint: `${props.stats.attendees} attendee${props.stats.attendees === 1 ? "" : "s"}`,
  },
  {
    key: "birthdays",
    icon: Gift,
    value: props.stats.birthdays,
    label: "Birthdays",
    hint: props.birthdayMonthLabel,
  },
]);

const bandWidth = (count) =>
  props.agedTotal > 0 ? `${(count / props.agedTotal) * 100}%` : "0%";
</script>

<template>
  <div class="shrink-0 border-b border-gray-200 px-3 py-3 dark:border-gray-700">
    <!-- One row of three so the whole report is readable without scrolling,
         even on a phone. -->
    <div class="grid grid-cols-3 divide-x divide-gray-200 dark:divide-gray-700">
      <div
        v-for="tile in tiles"
        :key="tile.key"
        class="flex flex-col items-center px-1 text-center"
      >
        <div class="flex items-center gap-1 text-gray-400 dark:text-gray-500">
          <component :is="tile.icon" class="h-3 w-3 shrink-0" />
          <span class="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide">
            {{ tile.label }}
          </span>
        </div>
        <p class="text-xl font-bold tabular-nums text-gray-900 dark:text-white sm:text-2xl">
          {{ loading ? "—" : tile.value }}
        </p>
        <p class="truncate text-[10px] text-gray-500 dark:text-gray-400">
          {{ loading ? "" : tile.hint }}
        </p>
      </div>
    </div>

    <!-- Age mix: the one distribution that changes what the church plans -->
    <div v-if="!loading && agedTotal > 0" class="mt-3">
      <div class="flex h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
        <div
          v-for="band in stats.bands"
          :key="band.key"
          :class="band.barClass"
          :style="{ width: bandWidth(band.count) }"
        ></div>
      </div>
      <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          v-for="band in stats.bands"
          :key="band.key"
          class="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 sm:text-xs"
        >
          <span :class="['h-2 w-2 shrink-0 rounded-full', band.dotClass]"></span>
          {{ band.label }}
          <span class="font-semibold tabular-nums text-gray-700 dark:text-gray-200">
            {{ band.count }}
          </span>
        </span>
        <span
          v-if="stats.unknownAge"
          class="text-[10px] text-gray-400 dark:text-gray-500 sm:text-xs"
        >
          {{ stats.unknownAge }} without an age
        </span>
      </div>
    </div>
  </div>
</template>
