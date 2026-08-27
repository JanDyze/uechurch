<script setup>
import { getFullName, getAvatarUrl, getSexIcon, getSexIconColor, formatBirthDate } from "../../utils/memberUtils";
import { useLongPress } from "../../composables/useLongPress";

const props = defineProps({
  member: {
    type: Object,
    required: true,
  },
  viewMode: {
    type: String,
    default: "simple",
  },
  selected: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["click", "contextmenu"]);

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
      'p-3 rounded-lg transition-all cursor-pointer select-none touch-callout-none',
      selected
        ? 'bg-primary/10 dark:bg-primary/20 border-2 border-primary shadow-lg shadow-primary/20'
        : 'bg-gray-50 dark:bg-gray-700/50 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
    ]"
  >
    <!-- Simple Grid View -->
    <div v-if="viewMode === 'simple'" class="flex flex-col gap-2">
      <div class="flex items-center gap-3">
        <img
          :src="getAvatarUrl(member)"
          :alt="getFullName(member)"
          class="h-12 w-12 rounded-full shrink-0"
        />
        <div class="flex-1 min-w-0">
          <p class="text-xs font-semibold text-gray-900 dark:text-white truncate">
            {{ getFullName(member) }}
          </p>
          <p
            v-if="member.nickname"
            class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate"
          >
            "{{ member.nickname }}"
          </p>
        </div>
      </div>
    </div>

    <!-- Detailed Grid View -->
    <div v-else class="flex flex-col gap-2">
      <div class="flex items-center gap-3 mb-1">
        <img
          :src="getAvatarUrl(member)"
          :alt="getFullName(member)"
          class="h-12 w-12 rounded-full shrink-0"
        />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <p class="text-xs font-semibold text-gray-900 dark:text-white truncate">
              {{ getFullName(member) }}
            </p>
            <span
              :class="['text-sm font-semibold', getSexIconColor(member.sex)]"
              :title="member.sex"
            >
              {{ getSexIcon(member.sex) }}
            </span>
          </div>
        </div>
      </div>
      <div class="w-full space-y-1">
        <p
          v-if="member.nickname"
          class="text-xs text-gray-500 dark:text-gray-400 truncate"
        >
          "{{ member.nickname }}"
        </p>
        <!-- Each row shows only when the member actually has that detail, so
             incomplete records never render empty labels or "Invalid Date". -->
        <div
          class="text-xs text-gray-500 dark:text-gray-400 space-y-0.5 pt-1 border-t border-gray-200 dark:border-gray-600"
        >
          <p v-if="formatBirthDate(member.dateOfBirth)" class="truncate">
            <span class="font-medium">DOB:</span>
            {{ formatBirthDate(member.dateOfBirth) }}
          </p>
          <p v-if="member.age !== null && member.age !== undefined" class="truncate">
            <span class="font-medium">Age:</span> {{ member.age }}
          </p>
          <p v-if="member.civilStatus" class="truncate">
            <span class="font-medium">Status:</span>
            {{ member.civilStatus }}
          </p>
          <p v-if="member.occupation" class="truncate">
            <span class="font-medium">Occ:</span> {{ member.occupation }}
          </p>
          <p v-if="member.contactNumber" class="truncate">
            <span class="font-medium">Contact:</span>
            {{ member.contactNumber }}
          </p>
          <p v-if="member.address" class="truncate text-xs" :title="member.address">
            <span class="font-medium">Address:</span> {{ member.address }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

