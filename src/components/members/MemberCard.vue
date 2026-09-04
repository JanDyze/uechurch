<script setup>
import { computed } from "vue";
import { getFullName, missingMemberDetails } from "../../utils/memberUtils";
import { Check } from "../../icons";
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
  // Picking mode: the page is gathering people up for one action, so a tap
  // ticks a name instead of opening it.
  picking: {
    type: Boolean,
    default: false,
  },
  checked: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["click", "contextmenu", "toggle"]);

// Selection still wins over this: it is what the user just did, while
// the amber is a standing property of the record.
const hasGaps = computed(() => missingMemberDetails(props.member).length > 0);

const handleContextMenu = (event) => {
  event.preventDefault();
  emit("contextmenu", { member: props.member, x: event.clientX, y: event.clientY });
};

// Touch devices have no right-click, so long-press opens the same menu. While
// picking, the whole card is already one big tap target and the menu's actions
// are about a single person, so it stays shut.
const longPress = useLongPress(({ x, y }) => {
  if (props.picking) return;
  emit("contextmenu", { member: props.member, x, y });
});

const handleClick = () => {
  if (longPress.consumeClick()) return;
  if (props.picking) {
    emit("toggle", props.member);
    return;
  }
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
      'p-3 rounded-lg transition-all cursor-pointer select-none touch-callout-none',
      picking && checked
        ? 'bg-primary/10 dark:bg-primary/20 border-2 border-primary'
        : selected
        ? 'bg-primary/10 dark:bg-primary/20 border-2 border-primary shadow-lg shadow-primary/20'
        : hasGaps
          ? 'bg-linear-to-br from-amber-100 via-amber-50 to-transparent border-2 border-amber-200 hover:from-amber-200 dark:from-amber-500/25 dark:via-amber-500/10 dark:to-transparent dark:border-amber-500/25 dark:hover:from-amber-500/35'
          : 'bg-gray-50 dark:bg-gray-700/50 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
    ]"
  >
    <!-- Name and nickname only: the full record lives one tap away in the
         details panel, so the grid stays scannable. -->
    <div class="flex items-center gap-3">
      <span
        v-if="picking"
        :class="[
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          checked
            ? 'bg-primary border-primary text-white'
            : 'border-gray-300 dark:border-gray-600 text-transparent',
        ]"
      >
        <Check class="h-3.5 w-3.5" />
      </span>
      <MemberAvatar :member="member" />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5 min-w-0">
          <p class="text-xs font-semibold text-gray-900 dark:text-white truncate">
            {{ getFullName(member) }}
          </p>
          <MemberAttentionBadge :member="member" />
          <YouBadge :member="member" />
        </div>
        <p
          v-if="member.nickname"
          class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate"
        >
          "{{ member.nickname }}"
        </p>
      </div>
    </div>
  </div>
</template>
