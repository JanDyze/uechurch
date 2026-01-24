<script setup>
import { getFullName, getAvatarUrl, getSexIcon, getSexIconColor } from "../../utils/memberUtils";

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
      'p-3 transition-all cursor-pointer select-none rounded-lg',
      selected
        ? 'bg-[#01779b]/10 dark:bg-[#01779b]/20 ring-1 ring-[#01779b]/30 dark:ring-[#22b8cf]/30'
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
        <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
          {{ getFullName(member) }}
        </p>
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
          <span
            :class="['text-base font-semibold', getSexIconColor(member.sex)]"
            :title="member.sex"
          >
            {{ getSexIcon(member.sex) }}
          </span>
          <span
            v-if="visibleFields.civilStatus"
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
        <div class="mt-1 space-y-1">
          <div
            class="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
          >
            <template v-if="visibleFields.dateOfBirth">
              <span
                ><span class="font-medium">DOB:</span>
                {{
                  new Date(member.dateOfBirth).toLocaleDateString()
                }}</span
              >
              <span
                v-if="visibleFields.age || visibleFields.occupation"
                class="hidden sm:inline"
                >•</span
              >
            </template>
            <template v-if="visibleFields.age">
              <span
                ><span class="font-medium">Age:</span>
                {{ member.age }}</span
              >
              <span
                v-if="visibleFields.occupation"
                class="hidden sm:inline"
                >•</span
              >
            </template>
            <template v-if="visibleFields.occupation">
              <span
                ><span class="font-medium">Occ:</span>
                {{ member.occupation }}</span
              >
            </template>
          </div>
          <div
            v-if="visibleFields.contactNumber"
            class="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
          >
            <span
              ><span class="font-medium">Contact:</span>
              {{ member.contactNumber }}</span
            >
          </div>
          <div
            v-if="visibleFields.address"
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

