<script setup>
import { getFullName, getAvatarUrl, getSexIcon, getSexIconColor, getFamilyRoleLabel } from "../../utils/memberUtils";

const props = defineProps({
  family: {
    type: Object,
    required: true,
  },
  layoutMode: {
    type: String,
    default: "grid",
  },
  viewMode: {
    type: String,
    default: "simple",
  },
  visibleFields: {
    type: Object,
    default: () => ({}),
  },
  selectedMemberId: {
    type: [String, Number],
    default: null,
  },
  isDrawerOpen: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["memberClick"]);
</script>

<template>
  <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-200 dark:border-gray-600">
      Family Group ({{ family.members.length }} member{{ family.members.length > 1 ? 's' : '' }})
    </h3>
    
    <!-- Grid Layout for Family Members -->
    <div
      v-if="layoutMode === 'grid'"
      :class="[
        'grid gap-3',
        isDrawerOpen ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
      ]"
    >
      <div
        v-for="member in family.members"
        :key="member.id"
        @click="emit('memberClick', member)"
        :class="[
          'p-3 rounded-lg border transition-all cursor-pointer',
          selectedMemberId === member.id || selectedMemberId === member.firestoreId
            ? 'bg-[#01779b]/10 dark:bg-[#01779b]/20 border-2 border-[#01779b] shadow-lg shadow-[#01779b]/20'
            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
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
              <span
                v-if="member.familyRole"
                class="inline-block mt-1 px-2 py-0.5 text-xs bg-[#01779b] text-white rounded-full font-medium"
              >
                {{ getFamilyRoleLabel(member.familyRole) }}
              </span>
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
            <span
              v-if="member.familyRole"
              class="inline-block px-2 py-0.5 text-xs bg-[#01779b] text-white rounded-full font-medium"
            >
              {{ getFamilyRoleLabel(member.familyRole) }}
            </span>
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
    </div>

    <!-- List Layout for Family Members -->
    <div v-else class="space-y-2">
      <div
        v-for="member in family.members"
        :key="member.id"
        @click="emit('memberClick', member)"
        :class="[
          'p-4 rounded-lg border transition-all cursor-pointer border-l-4',
          selectedMemberId === member.id || selectedMemberId === member.firestoreId
            ? 'bg-[#01779b]/10 dark:bg-[#01779b]/20 border-[#01779b] border-l-4 shadow-sm'
            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 border-l-transparent hover:bg-gray-50 dark:hover:bg-gray-700'
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
            <span
              v-if="member.familyRole"
              class="inline-block mt-1 px-2 py-0.5 text-xs bg-[#01779b] text-white rounded-full font-medium"
            >
              {{ getFamilyRoleLabel(member.familyRole) }}
            </span>
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
                v-if="member.familyRole"
                class="px-2 py-0.5 text-xs bg-[#01779b] text-white rounded-full font-medium"
              >
                {{ getFamilyRoleLabel(member.familyRole) }}
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
    </div>
  </div>
</template>

