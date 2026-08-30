<script setup>
import { computed } from "vue";
import { getFullName, missingMemberDetails } from "../../utils/memberUtils";
import MemberAvatar from "./MemberAvatar.vue";
import YouBadge from "./YouBadge.vue";
import MemberAttentionBadge from "./MemberAttentionBadge.vue";
import { useLongPress } from "../../composables/useLongPress";

const props = defineProps({
  member: {
    type: Object,
    required: true,
  },
  selected: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["click", "contextmenu"]);

// Selection still wins over this: it is what the user just did, while
// the amber is a standing property of the record.
const hasGaps = computed(() => missingMemberDetails(props.member).length > 0);

const handleContextMenu = (event) => {
  event.preventDefault();
  emit("contextmenu", { member: props.member, x: event.clientX, y: event.clientY });
};

// Touch devices have no right-click, so long-press opens the same menu
const longPress = useLongPress(({ x, y }) => {
  emit("contextmenu", { member: props.member, x, y });
});

const handleClick = () => {
  if (longPress.consumeClick()) return;
  emit("click", props.member);
};
</script>

<template>
  <div
    @click="handleClick"
    @contextmenu="handleContextMenu"
    @touchstart="longPress.onTouchStart"
    @touchmove="longPress.onTouchMove"
    @touchend="longPress.onTouchEnd"
    @touchcancel="longPress.onTouchEnd"
    :class="[
      'p-3 transition-all cursor-pointer select-none rounded-lg touch-callout-none',
      selected
        ? 'bg-primary/10 dark:bg-primary/20 ring-1 ring-primary/30 dark:ring-primary-light/30'
        : hasGaps
          ? 'bg-linear-to-r from-amber-100 via-amber-50 to-transparent ring-1 ring-amber-200 hover:from-amber-200 dark:from-amber-500/20 dark:via-amber-500/10 dark:to-transparent dark:ring-amber-500/25 dark:hover:from-amber-500/30'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
    ]"
  >
    <!-- Name and nickname only: the full record lives one tap away in the
         details panel, so the list stays scannable. -->
    <div class="flex items-center gap-4">
      <MemberAvatar :member="member" />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5 min-w-0">
          <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
            {{ getFullName(member) }}
          </p>
          <MemberAttentionBadge :member="member" />
          <YouBadge :member="member" />
        </div>
        <p
          v-if="member.nickname"
          class="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate"
        >
          "{{ member.nickname }}"
        </p>
      </div>
    </div>
  </div>
</template>
