<script setup>
import { ref, computed } from "vue";
import { X, Image as ImageIcon, ChevronDown, User, Phone, Church } from "lucide-vue-next";
import ImageCropper from "./ImageCropper.vue";
import FloatingInput from "../common/FloatingInput.vue";
import { calculateAgeFromDate } from "../../utils/memberUtils";

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

// Section collapse state
const sections = ref({
  personal: true,
  contact: false,
  church: false,
});

const toggleSection = (section) => {
  sections.value[section] = !sections.value[section];
};

// Computed age from DOB
const computedAge = computed(() => {
  if (props.newMember.dateOfBirth) {
    return calculateAgeFromDate(props.newMember.dateOfBirth);
  }
  return null;
});

const handleImageUpdate = (base64Image) => {
  emit('update:newMember', { ...props.newMember, image: base64Image });
};

const updateField = (field, value) => {
  emit('update:newMember', { ...props.newMember, [field]: value });
};

const toggleTag = (tag) => {
  const tags = props.newMember.tags.includes(tag)
    ? props.newMember.tags.filter(t => t !== tag)
    : [...props.newMember.tags, tag];
  updateField('tags', tags);
};

// Options for select fields
const sexOptions = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
];

const civilStatusOptions = [
  { value: 'Single', label: 'Single' },
  { value: 'Married', label: 'Married' },
  { value: 'Widowed', label: 'Widowed' },
  { value: 'Separated', label: 'Separated' },
];

</script>

<template>
  <Transition name="drawer">
    <div
      v-if="showAddMember"
      class="add-member-drawer m-3 rounded-2xl border-2 border-green-500/30 dark:border-green-400/30 bg-white dark:bg-gray-800 w-[calc(50%-1.5rem)] h-[calc(100%-1.5rem)] flex flex-col flex-shrink-0 shadow-xl shadow-green-500/25 dark:shadow-green-400/20"
    >
      <!-- Header -->
      <div class="flex-shrink-0 bg-gradient-to-r from-green-500/10 to-transparent dark:from-green-400/10 dark:to-transparent rounded-t-2xl border-b border-green-500/20 dark:border-green-400/20 px-6 py-4 flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            Add New Member
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Fill in the details below</p>
        </div>
        <button
          @click="$emit('update:showAddMember', false)"
          class="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <!-- Scrollable Form Content -->
      <div class="flex-1 overflow-y-auto">
        <form @submit.prevent="$emit('addMember')" class="p-4 space-y-3">
          
          <!-- Profile Image Section -->
          <div class="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 mb-4">
            <div class="flex items-center gap-4">
              <div class="relative">
                <img
                  :src="newMember.image || `https://api.dicebear.com/9.x/dylan/svg?seed=${encodeURIComponent((newMember.firstName || '') + ' ' + (newMember.lastName || ''))}`"
                  alt="Avatar"
                  class="w-20 h-20 rounded-full border-3 border-white dark:border-gray-600 object-cover shadow-lg"
                />
                <button
                  type="button"
                  @click="showImageCropper = true"
                  class="absolute -bottom-1 -right-1 p-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors shadow-lg"
                  title="Upload Image"
                >
                  <ImageIcon class="h-4 w-4" />
                </button>
              </div>
              <div class="flex-1">
                <p class="text-sm font-medium text-gray-900 dark:text-white">Profile Photo</p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">Upload a photo or use auto-generated avatar</p>
                <div class="flex gap-2">
                  <button
                    type="button"
                    @click="showImageCropper = true"
                    class="px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                  >
                    {{ newMember.image ? 'Change' : 'Upload' }}
                  </button>
                  <button
                    v-if="newMember.image"
                    type="button"
                    @click="updateField('image', null)"
                    class="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Personal Information Section -->
          <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              type="button"
              @click="toggleSection('personal')"
              class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div class="flex items-center gap-3">
                <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <User class="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div class="text-left">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">Personal Information</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Name, gender, birth date</p>
                </div>
              </div>
              <ChevronDown :class="['h-5 w-5 text-gray-400 transition-transform', sections.personal ? 'rotate-180' : '']" />
            </button>
            
            <Transition name="section">
              <div v-if="sections.personal" class="p-4 space-y-4 border-t border-gray-100 dark:border-gray-700">
                <div class="grid grid-cols-2 gap-3">
                  <FloatingInput
                    :modelValue="newMember.firstName"
                    @update:modelValue="updateField('firstName', $event)"
                    label="First Name"
                    required
                  />
                  <FloatingInput
                    :modelValue="newMember.lastName"
                    @update:modelValue="updateField('lastName', $event)"
                    label="Last Name"
                    required
                  />
                </div>
                
                <div class="grid grid-cols-2 gap-3">
                  <FloatingInput
                    :modelValue="newMember.nickname"
                    @update:modelValue="updateField('nickname', $event)"
                    label="Nickname"
                  />
                  <FloatingInput
                    :modelValue="newMember.sex"
                    @update:modelValue="updateField('sex', $event)"
                    label="Gender"
                    type="select"
                    :options="sexOptions"
                    required
                  />
                </div>
                
                <div class="grid grid-cols-2 gap-3">
                  <FloatingInput
                    :modelValue="newMember.civilStatus"
                    @update:modelValue="updateField('civilStatus', $event)"
                    label="Civil Status"
                    type="select"
                    :options="civilStatusOptions"
                  />
                  <div class="relative">
                    <FloatingInput
                      :modelValue="newMember.dateOfBirth"
                      @update:modelValue="updateField('dateOfBirth', $event); $emit('calculateAge')"
                      label="Date of Birth"
                      type="date"
                    />
                    <span
                      v-if="computedAge !== null"
                      class="absolute -top-2 right-2 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full"
                    >
                      {{ computedAge }} yrs
                    </span>
                  </div>
                </div>
              </div>
            </Transition>
          </div>

          <!-- Contact Information Section -->
          <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              type="button"
              @click="toggleSection('contact')"
              class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div class="flex items-center gap-3">
                <div class="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Phone class="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div class="text-left">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">Contact Information</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Address, phone, occupation</p>
                </div>
              </div>
              <ChevronDown :class="['h-5 w-5 text-gray-400 transition-transform', sections.contact ? 'rotate-180' : '']" />
            </button>
            
            <Transition name="section">
              <div v-if="sections.contact" class="p-4 space-y-4 border-t border-gray-100 dark:border-gray-700">
                <FloatingInput
                  :modelValue="newMember.address"
                  @update:modelValue="updateField('address', $event)"
                  label="Address"
                  type="textarea"
                />
                
                <div class="grid grid-cols-2 gap-3">
                  <FloatingInput
                    :modelValue="newMember.contactNumber"
                    @update:modelValue="updateField('contactNumber', $event)"
                    label="Contact Number"
                    type="tel"
                  />
                  <FloatingInput
                    :modelValue="newMember.occupation"
                    @update:modelValue="updateField('occupation', $event)"
                    label="Occupation"
                  />
                </div>
              </div>
            </Transition>
          </div>

          <!-- Church Information Section -->
          <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              type="button"
              @click="toggleSection('church')"
              class="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div class="flex items-center gap-3">
                <div class="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Church class="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div class="text-left">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">Church Information</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Membership, role, tags</p>
                </div>
              </div>
              <ChevronDown :class="['h-5 w-5 text-gray-400 transition-transform', sections.church ? 'rotate-180' : '']" />
            </button>
            
            <Transition name="section">
              <div v-if="sections.church" class="p-4 space-y-4 border-t border-gray-100 dark:border-gray-700">
                <!-- Member Status Toggle -->
                <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div>
                    <p class="text-sm font-medium text-gray-900 dark:text-white">Church Member</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Is this person an official member?</p>
                  </div>
                  <button
                    type="button"
                    @click="updateField('isMember', !newMember.isMember)"
                    :class="[
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#01779b] focus:ring-offset-2',
                      newMember.isMember ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                    ]"
                  >
                    <span
                      :class="[
                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
                        newMember.isMember ? 'translate-x-6' : 'translate-x-1'
                      ]"
                    ></span>
                  </button>
                </div>
                
                <!-- Tags -->
                <div>
                  <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</p>
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="tag in allTags"
                      :key="tag"
                      type="button"
                      @click="toggleTag(tag)"
                      :class="[
                        'px-3 py-1.5 text-xs font-medium rounded-full transition-all',
                        newMember.tags.includes(tag)
                          ? 'bg-[#01779b] dark:bg-[#22b8cf] text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600',
                      ]"
                    >
                      {{ tag }}
                    </button>
                  </div>
                </div>
              </div>
            </Transition>
          </div>

        </form>
      </div>

      <!-- Sticky Footer -->
      <div class="flex-shrink-0 bg-gradient-to-r from-green-500/10 to-transparent dark:from-green-400/10 dark:to-transparent rounded-b-2xl border-t border-green-500/20 dark:border-green-400/20 px-6 py-4">
        <div class="flex gap-3">
          <button
            type="button"
            @click="$emit('update:showAddMember', false)"
            class="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <div class="flex-1 relative group">
            <button
              type="button"
              @click="$emit('addMember')"
              :disabled="!canAddMember"
              :class="[
                'w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-all',
                canAddMember
                  ? 'text-white bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/25 hover:shadow-green-500/40'
                  : 'text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 cursor-not-allowed'
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
  transition: max-width 0.3s ease-out, opacity 0.3s ease;
}

.drawer-enter-from.add-member-drawer,
.drawer-leave-to.add-member-drawer {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
}

/* Section collapse animation */
.section-enter-active,
.section-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}

.section-enter-from,
.section-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.section-enter-to,
.section-leave-from {
  max-height: 500px;
}
</style>
