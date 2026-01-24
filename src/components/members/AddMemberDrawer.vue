<script setup>
import { ref } from "vue";
import { X, Image as ImageIcon } from "lucide-vue-next";
import ImageCropper from "./ImageCropper.vue";

const props = defineProps({
  showAddMember: {
    type: Boolean,
    default: false,
  },
  newMember: {
    type: Object,
    required: true,
  },
  allTags: {
    type: Array,
    default: () => [],
  },
  canAddMember: {
    type: Boolean,
    default: false,
  },
  addMemberTooltip: {
    type: String,
    default: "",
  },
});

const emit = defineEmits([
  "update:showAddMember",
  "update:newMember",
  "addMember",
  "calculateAge",
]);

const showImageCropper = ref(false);

const handleImageUpdate = (base64Image) => {
  emit('update:newMember', { ...props.newMember, image: base64Image });
};
</script>

<template>
  <Transition name="drawer">
    <div
      v-if="showAddMember"
      class="add-member-drawer border-l-4 border-[#01779b] bg-green-50/20 dark:bg-gray-800 w-1/2 h-full flex flex-col flex-shrink-0 shadow-2xl shadow-[#01779b]/20"
    >
      <!-- Header -->
      <div class="flex-shrink-0 bg-green-50/20 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          Add New Member
        </h3>
        <button
          @click="$emit('update:showAddMember', false)"
          class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <!-- Scrollable Form Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <form @submit.prevent="$emit('addMember')" class="space-y-4">
          <div class="space-y-4">
            <!-- Image Upload -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Profile Image
              </label>
              <div class="flex items-center gap-4">
                <div class="relative">
                  <img
                    :src="newMember.image || `https://api.dicebear.com/9.x/pixel-art/svg?seed=${encodeURIComponent(newMember.firstName + ' ' + newMember.lastName)}`"
                    alt="Avatar"
                    class="w-20 h-20 rounded-full border-2 border-gray-300 dark:border-gray-600 object-cover"
                  />
                  <button
                    type="button"
                    @click="showImageCropper = true"
                    class="absolute bottom-0 right-0 p-1.5 bg-[#01779b] text-white rounded-full hover:bg-[#015a77] transition-colors shadow-sm"
                    title="Upload Image"
                  >
                    <ImageIcon class="h-4 w-4" />
                  </button>
                </div>
                <div class="flex-1">
                  <button
                    type="button"
                    @click="showImageCropper = true"
                    class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {{ newMember.image ? 'Change Image' : 'Upload Image' }}
                  </button>
                  <button
                    v-if="newMember.image"
                    type="button"
                    @click="$emit('update:newMember', { ...newMember, image: null })"
                    class="ml-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>

            <!-- First Name -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                First Name <span class="text-red-500">*</span>
              </label>
              <input
                :value="newMember.firstName"
                @input="$emit('update:newMember', { ...newMember, firstName: $event.target.value })"
                type="text"
                required
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
                placeholder="First Name"
              />
            </div>

            <!-- Last Name -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Last Name <span class="text-red-500">*</span>
              </label>
              <input
                :value="newMember.lastName"
                @input="$emit('update:newMember', { ...newMember, lastName: $event.target.value })"
                type="text"
                required
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
                placeholder="Last Name"
              />
            </div>

            <!-- Nickname -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nickname
              </label>
              <input
                :value="newMember.nickname"
                @input="$emit('update:newMember', { ...newMember, nickname: $event.target.value })"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
                placeholder="Nickname"
              />
            </div>

            <!-- Sex -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sex <span class="text-red-500">*</span>
              </label>
              <select
                :value="newMember.sex"
                @change="$emit('update:newMember', { ...newMember, sex: $event.target.value })"
                required
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <!-- Date of Birth -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date of Birth
              </label>
              <input
                :value="newMember.dateOfBirth"
                @input="$emit('update:newMember', { ...newMember, dateOfBirth: $event.target.value })"
                @change="$emit('calculateAge')"
                type="date"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
              />
            </div>

            <!-- Age -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Age
              </label>
              <input
                :value="newMember.age"
                @input="$emit('update:newMember', { ...newMember, age: Number($event.target.value) })"
                type="number"
                min="0"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
                placeholder="Age"
              />
            </div>

            <!-- Civil Status -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Civil Status
              </label>
              <select
                :value="newMember.civilStatus"
                @change="$emit('update:newMember', { ...newMember, civilStatus: $event.target.value })"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
              >
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Divorced">Divorced</option>
              </select>
            </div>

            <!-- Family Role -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Family Role
              </label>
              <select
                :value="newMember.familyRole"
                @change="$emit('update:newMember', { ...newMember, familyRole: $event.target.value })"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
              >
                <option value="">None</option>
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Spouse">Spouse</option>
                <option value="Son">Son</option>
                <option value="Daughter">Daughter</option>
                <option value="Child">Child</option>
                <option value="Brother">Brother</option>
                <option value="Sister">Sister</option>
              </select>
            </div>

            <!-- Address -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Address
              </label>
              <input
                :value="newMember.address"
                @input="$emit('update:newMember', { ...newMember, address: $event.target.value })"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
                placeholder="Bayog, Centro, Looban, or Ibaba, Canubing II, Calapan City"
              />
            </div>

            <!-- Contact Number -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Contact Number
              </label>
              <input
                :value="newMember.contactNumber"
                @input="$emit('update:newMember', { ...newMember, contactNumber: $event.target.value })"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
                placeholder="0912-345-6789"
              />
            </div>

            <!-- Occupation -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Occupation
              </label>
              <input
                :value="newMember.occupation"
                @input="$emit('update:newMember', { ...newMember, occupation: $event.target.value })"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
                placeholder="Occupation"
              />
            </div>

            <!-- Tags -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tags
              </label>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="tag in allTags"
                  :key="tag"
                  type="button"
                  @click="
                    const tags = newMember.tags.includes(tag)
                      ? newMember.tags.filter(t => t !== tag)
                      : [...newMember.tags, tag];
                    $emit('update:newMember', { ...newMember, tags });
                  "
                  :class="[
                    'px-3 py-1 text-xs rounded-full transition-colors',
                    newMember.tags.includes(tag)
                      ? 'bg-[#01779b] text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                  ]"
                >
                  {{ tag }}
                </button>
              </div>
            </div>

            <!-- Is Member -->
            <div class="flex items-center justify-between py-2 border-t border-gray-200 dark:border-gray-700 pt-4">
              <span class="text-sm text-gray-700 dark:text-gray-300 font-medium">Is Member</span>
              <button
                type="button"
                @click="$emit('update:newMember', { ...newMember, isMember: !newMember.isMember })"
                :class="[
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#01779b] focus:ring-offset-2',
                  newMember.isMember ? 'bg-[#01779b]' : 'bg-gray-300 dark:bg-gray-600'
                ]"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    newMember.isMember ? 'translate-x-6' : 'translate-x-1'
                  ]"
                ></span>
              </button>
            </div>
          </div>
        </form>
      </div>

      <!-- Sticky Footer -->
      <div class="flex-shrink-0 bg-green-50/20 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
        <div class="flex justify-end gap-3">
          <div class="flex-1 relative group">
            <button
              type="button"
              @click="$emit('addMember')"
              :disabled="!canAddMember"
              :class="[
                'w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                canAddMember
                  ? 'text-white bg-[#01779b] dark:bg-[#01779b] hover:bg-[#015a77] dark:hover:bg-[#015a77] cursor-pointer'
                  : 'text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50'
              ]"
            >
              Add Member
            </button>
            <!-- Tooltip -->
            <div
              v-if="!canAddMember && addMemberTooltip"
              class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50"
            >
              {{ addMemberTooltip }}
              <div class="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </Transition>

    <!-- Image Cropper -->
    <ImageCropper
      v-model:show="showImageCropper"
      v-model="newMember.image"
      @update:modelValue="handleImageUpdate"
    />
  </template>

<style>
.add-member-drawer {
  transition: max-width 0.3s ease-out, opacity 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}

.drawer-enter-from.add-member-drawer,
.drawer-leave-to.add-member-drawer {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
}
</style>

