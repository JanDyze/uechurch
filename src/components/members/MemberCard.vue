<script setup>
import { getFullName, getAvatarUrl, getSexIcon, getSexIconColor, getFamilyRoleLabel } from "../../utils/memberUtils";

const props = defineProps({
  member: {
    type: Object,
    required: true,
  },
  viewMode: {
    type: String,
    default: "simple",
  },
  visibleFields: {
    type: Object,
    default: () => ({}),
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
</script>

<template>
  <div 
    @click="emit('click', member)"
    @contextmenu="handleContextMenu"
    :class="[
      'p-3 rounded-lg transition-all cursor-pointer select-none',
      selected
        ? 'bg-[#01779b]/10 dark:bg-[#01779b]/20 border-2 border-[#01779b] shadow-lg shadow-[#01779b]/20'
        : 'bg-gray-50 dark:bg-gray-700/50 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
    ]"
  >
    <!-- Simple Grid View -->
    <div v-if="viewMode === 'simple'" class="flex flex-col gap-2">
      <div class="flex items-center gap-3">
        <img
          :src="getAvatarUrl(member)"
          :alt="getFullName(member)"
          class="h-12 w-12 rounded-full flex-shrink-0"
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
          class="h-12 w-12 rounded-full flex-shrink-0"
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
        <div
          class="text-xs text-gray-500 dark:text-gray-400 space-y-0.5 pt-1 border-t border-gray-200 dark:border-gray-600"
        >
          <p v-if="visibleFields.dateOfBirth" class="truncate">
            <span class="font-medium">DOB:</span>
            {{ new Date(member.dateOfBirth).toLocaleDateString() }}
          </p>
          <p v-if="visibleFields.age" class="truncate">
            <span class="font-medium">Age:</span> {{ member.age }}
          </p>
          <p v-if="visibleFields.civilStatus" class="truncate">
            <span class="font-medium">Status:</span>
            {{ member.civilStatus }}
          </p>
          <p v-if="visibleFields.occupation" class="truncate">
            <span class="font-medium">Occ:</span> {{ member.occupation }}
          </p>
          <p v-if="visibleFields.contactNumber" class="truncate">
            <span class="font-medium">Contact:</span>
            {{ member.contactNumber }}
          </p>
          <p
            v-if="visibleFields.address"
            class="truncate text-xs"
            :title="member.address"
          >
            <span class="font-medium">Address:</span> {{ member.address }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

