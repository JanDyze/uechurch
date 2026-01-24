<script setup>
import { ref, computed, watch } from "vue";
import { X, Edit2, Trash2, Save, User, Calendar, MapPin, Phone, Briefcase, Users, Tag, Image as ImageIcon } from "lucide-vue-next";
import { getFullName, getAvatarUrl, getSexIcon, getSexIconColor, getFamilyRoleLabel, calculateAgeFromDate } from "../../utils/memberUtils";
import ImageCropper from "./ImageCropper.vue";

const props = defineProps({
  showDetails: {
    type: Boolean,
    default: false,
  },
  member: {
    type: Object,
    default: null,
  },
  allTags: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["update:showDetails", "update", "delete"]);

const isEditing = ref(false);
const editedMember = ref({});

// Watch member changes to reset edit state
watch(() => props.member, (newMember) => {
  if (newMember) {
    editedMember.value = { ...newMember };
    isEditing.value = false;
  }
}, { immediate: true });

// Validation
const canSave = computed(() => {
  return editedMember.value.firstName?.trim() !== '' &&
         editedMember.value.lastName?.trim() !== '' &&
         editedMember.value.sex !== '';
});

const handleEdit = () => {
  isEditing.value = true;
  editedMember.value = { ...props.member };
};

const handleCancel = () => {
  isEditing.value = false;
  editedMember.value = { ...props.member };
};

const handleSave = () => {
  if (!canSave.value) return;
  
  // Calculate age if date of birth changed
  if (editedMember.value.dateOfBirth) {
    editedMember.value.age = calculateAgeFromDate(editedMember.value.dateOfBirth);
  }
  
  // Clean up undefined values
  const cleanedMember = { ...editedMember.value };
  Object.keys(cleanedMember).forEach(key => {
    if (cleanedMember[key] === undefined || cleanedMember[key] === '') {
      if (key !== 'id' && key !== 'firestoreId' && key !== 'tags' && key !== 'isMember' && key !== 'image') {
        delete cleanedMember[key];
      }
    }
  });
  
  // Preserve image field even if null (to allow removing image)
  if (editedMember.value.image === null || editedMember.value.image === '') {
    cleanedMember.image = null;
  }
  
  emit("update", cleanedMember);
  isEditing.value = false;
};

const handleDelete = () => {
  emit("delete", props.member);
};

const toggleTag = (tag) => {
  if (!editedMember.value.tags) {
    editedMember.value.tags = [];
  }
  const index = editedMember.value.tags.indexOf(tag);
  if (index > -1) {
    editedMember.value.tags.splice(index, 1);
  } else {
    editedMember.value.tags.push(tag);
  }
};

const showImageCropper = ref(false);

const handleImageUpdate = (base64Image) => {
  editedMember.value.image = base64Image;
};
</script>

<template>
  <Transition name="drawer">
    <div
      v-if="showDetails && member"
      class="add-member-drawer border-l-4 border-[#01779b] bg-gray-50 dark:bg-gray-900 w-1/2 h-full flex flex-col flex-shrink-0 shadow-2xl shadow-[#01779b]/20"
    >
      <!-- Header -->
      <div class="flex-shrink-0 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ isEditing ? 'Edit Member' : 'Member Details' }}
        </h3>
        <button
          @click="$emit('update:showDetails', false)"
          class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <!-- Scrollable Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <div v-if="!isEditing" class="space-y-6">
          <!-- Avatar and Name -->
          <div class="flex flex-col items-center text-center">
            <div class="relative mb-4">
              <img
                :src="getAvatarUrl(member)"
                :alt="getFullName(member)"
                class="h-24 w-24 rounded-full"
              />
              <button
                v-if="isEditing"
                @click="showImageCropper = true"
                class="absolute bottom-0 right-0 p-2 bg-[#01779b] text-white rounded-full hover:bg-[#015a77] transition-colors shadow-sm"
                title="Change Image"
              >
                <ImageIcon class="h-4 w-4" />
              </button>
            </div>
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">
              {{ getFullName(member) }}
            </h2>
            <p v-if="member.nickname" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              "{{ member.nickname }}"
            </p>
            <div class="flex items-center gap-2 mt-2">
              <span :class="['text-2xl', getSexIconColor(member.sex)]" :title="member.sex">
                {{ getSexIcon(member.sex) }}
              </span>
              <span v-if="member.familyRole" class="px-2 py-1 text-xs font-medium rounded-full bg-[#01779b]/10 text-[#01779b] dark:bg-[#01779b]/20">
                {{ getFamilyRoleLabel(member.familyRole) }}
              </span>
            </div>
          </div>

          <!-- Details Grid -->
          <div class="grid grid-cols-1 gap-4">
            <div v-if="member.dateOfBirth" class="flex items-start gap-3">
              <Calendar class="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Date of Birth</p>
                <p class="text-sm text-gray-900 dark:text-white">
                  {{ new Date(member.dateOfBirth).toLocaleDateString() }}
                  <span v-if="member.age" class="text-gray-500">({{ member.age }} years old)</span>
                </p>
              </div>
            </div>

            <div v-if="member.civilStatus" class="flex items-start gap-3">
              <User class="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Civil Status</p>
                <p class="text-sm text-gray-900 dark:text-white">{{ member.civilStatus }}</p>
              </div>
            </div>

            <div v-if="member.address" class="flex items-start gap-3">
              <MapPin class="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Address</p>
                <p class="text-sm text-gray-900 dark:text-white">{{ member.address }}</p>
              </div>
            </div>

            <div v-if="member.contactNumber" class="flex items-start gap-3">
              <Phone class="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Contact Number</p>
                <p class="text-sm text-gray-900 dark:text-white">{{ member.contactNumber }}</p>
              </div>
            </div>

            <div v-if="member.occupation" class="flex items-start gap-3">
              <Briefcase class="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Occupation</p>
                <p class="text-sm text-gray-900 dark:text-white">{{ member.occupation }}</p>
              </div>
            </div>

            <div v-if="member.tags && member.tags.length > 0" class="flex items-start gap-3">
              <Tag class="h-5 w-5 text-gray-400 mt-0.5" />
              <div class="flex-1">
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Tags</p>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="tag in member.tags"
                    :key="tag"
                    class="px-2 py-1 text-xs rounded-full bg-[#01779b]/10 text-[#01779b] dark:bg-[#01779b]/20"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
              <Users class="h-5 w-5 text-gray-400" />
              <div class="flex-1">
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Member Status</p>
                <p class="text-sm text-gray-900 dark:text-white">
                  {{ member.isMember ? 'Member' : 'Non-Member' }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Edit Form -->
        <div v-else class="space-y-4">
          <!-- Image Upload -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Profile Image
            </label>
            <div class="flex items-center gap-4">
              <div class="relative">
                <img
                  :src="editedMember.image || getAvatarUrl(editedMember)"
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
                  {{ editedMember.image ? 'Change Image' : 'Upload Image' }}
                </button>
                <button
                  v-if="editedMember.image"
                  type="button"
                  @click="editedMember.image = null"
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
              v-model="editedMember.firstName"
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
              v-model="editedMember.lastName"
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
              v-model="editedMember.nickname"
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
              v-model="editedMember.sex"
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
              v-model="editedMember.dateOfBirth"
              @input="editedMember.age = calculateAgeFromDate(editedMember.dateOfBirth)"
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
              v-model.number="editedMember.age"
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
              v-model="editedMember.civilStatus"
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
              v-model="editedMember.familyRole"
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
              v-model="editedMember.address"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
              placeholder="Address"
            />
          </div>

          <!-- Contact Number -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Contact Number
            </label>
            <input
              v-model="editedMember.contactNumber"
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
              v-model="editedMember.occupation"
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
                @click="toggleTag(tag)"
                :class="[
                  'px-3 py-1 text-xs rounded-full transition-colors',
                  editedMember.tags?.includes(tag)
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
              @click="editedMember.isMember = !editedMember.isMember"
              :class="[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#01779b] focus:ring-offset-2',
                editedMember.isMember ? 'bg-[#01779b]' : 'bg-gray-300 dark:bg-gray-600'
              ]"
            >
              <span
                :class="[
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  editedMember.isMember ? 'translate-x-6' : 'translate-x-1'
                ]"
              ></span>
            </button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex-shrink-0 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
        <div v-if="!isEditing" class="flex justify-end gap-3">
          <button
            @click="handleDelete"
            class="px-4 py-2 text-sm font-medium text-white bg-red-600 dark:bg-red-600 rounded-lg hover:bg-red-700 dark:hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <Trash2 class="h-4 w-4" />
            Delete
          </button>
          <button
            @click="handleEdit"
            class="px-4 py-2 text-sm font-medium text-white bg-[#01779b] dark:bg-[#01779b] rounded-lg hover:bg-[#015a77] dark:hover:bg-[#015a77] transition-colors flex items-center gap-2"
          >
            <Edit2 class="h-4 w-4" />
            Edit
          </button>
        </div>
        <div v-else class="flex justify-end gap-3">
          <button
            @click="handleCancel"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            @click="handleSave"
            :disabled="!canSave"
            :class="[
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2',
              canSave
                ? 'text-white bg-[#01779b] dark:bg-[#01779b] hover:bg-[#015a77] dark:hover:bg-[#015a77] cursor-pointer'
                : 'text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50'
            ]"
          >
            <Save class="h-4 w-4" />
            Save Changes
          </button>
        </div>
        </div>
      </div>
    </Transition>

    <!-- Image Cropper -->
    <ImageCropper
      v-model:show="showImageCropper"
      v-model="editedMember.image"
      @update:modelValue="handleImageUpdate"
    />
  </template>

<style>
.add-member-drawer {
  transition: max-width 0.3s ease-out, opacity 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

.drawer-enter-from.add-member-drawer,
.drawer-leave-to.add-member-drawer {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
}
</style>

