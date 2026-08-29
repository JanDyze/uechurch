<script setup>
import { computed } from "vue";
import { getFullName, getAvatarUrl, getSexIcon, getSexIconColor, formatBirthDate } from "../../utils/memberUtils";
import YouBadge from "./YouBadge.vue";
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

const summaryParts = computed(() => {
  const parts = [];
  const dob = formatBirthDate(props.member.dateOfBirth);
  if (dob) parts.push({ label: "DOB", value: dob });
  if (props.member.age !== null && props.member.age !== undefined) {
    parts.push({ label: "Age", value: props.member.age });
  }
  if (props.member.occupation) {
    parts.push({ label: "Occ", value: props.member.occupation });
  }
  return parts;
});

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
        : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
    ]"
  >
    <!-- Simple List View -->
    <div v-if="viewMode === 'simple'" class="flex items-center gap-4">
      <img
        :src="getAvatarUrl(member)"
        :alt="getFullName(member)"
        class="h-12 w-12 rounded-full"
      />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5 min-w-0">
          <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
            {{ getFullName(member) }}
          </p>
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

    <!-- Detailed List View -->
    <div v-else class="flex items-center gap-4">
      <img
        :src="getAvatarUrl(member)"
        :alt="getFullName(member)"
        class="h-12 w-12 rounded-full"
      />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-3 flex-wrap">
          <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
            {{ getFullName(member) }}
          </p>
          <YouBadge :member="member" />
          <span
            :class="['text-base font-semibold', getSexIconColor(member.sex)]"
            :title="member.sex"
          >
            {{ getSexIcon(member.sex) }}
          </span>
          <span
            v-if="member.civilStatus"
            class="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200"
          >
            {{ member.civilStatus }}
          </span>
        </div>
        <p
          v-if="member.nickname"
          class="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate"
        >
          "{{ member.nickname }}"
        </p>
        <!-- Only the details this member actually has, joined by separators
             that appear between present values rather than around blanks. -->
        <div class="mt-1 space-y-1">
          <div
            v-if="summaryParts.length"
            class="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
          >
            <template v-for="(part, index) in summaryParts" :key="part.label">
              <span
                ><span class="font-medium">{{ part.label }}:</span>
                {{ part.value }}</span
              >
              <span
                v-if="index < summaryParts.length - 1"
                class="hidden sm:inline"
                >•</span
              >
            </template>
          </div>
          <div
            v-if="member.contactNumber"
            class="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
          >
            <span
              ><span class="font-medium">Contact:</span>
              {{ member.contactNumber }}</span
            >
          </div>
          <div
            v-if="member.address"
            class="text-xs text-gray-400 dark:text-gray-500 truncate"
            :title="member.address"
          >
            <span class="font-medium">Address:</span> {{ member.address }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

