<script setup>
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import { X, Trash2, User, Phone, Briefcase, Image as ImageIcon, ExternalLink, Edit2, Check } from "lucide-vue-next";
import { getFullName, getAvatarUrl, getSexIcon, getSexIconColor, calculateAgeFromDate } from "../../utils/memberUtils";
import { useMediaQuery } from "../../composables/useMediaQuery";
import ImageCropper from "./ImageCropper.vue";
import InlineEditField from "../common/InlineEditField.vue";

const router = useRouter();
const isMobile = useMediaQuery("(max-width: 1023px)");

// Edit mode state
const isEditMode = ref(false);

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
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:showDetails", "update", "delete"]);

// Local copy of member data
const localMember = ref({});

// Watch member changes to sync local copy
watch(() => props.member, (newMember) => {
  if (newMember) {
    localMember.value = { ...newMember };
  }
}, { immediate: true, deep: true });

// Reset edit mode when panel closes
watch(() => props.showDetails, (newVal) => {
  if (!newVal) {
    isEditMode.value = false;
  }
});

// Handle field save - immediately update
const handleFieldSave = (field, value) => {
  localMember.value[field] = value;
  
  // Calculate age if date of birth changed
  if (field === 'dateOfBirth' && value) {
    localMember.value.age = calculateAgeFromDate(value);
  }
  
  // Emit update with cleaned data
  const cleanedMember = { ...localMember.value };
  Object.keys(cleanedMember).forEach(key => {
    if (cleanedMember[key] === undefined || cleanedMember[key] === '') {
      if (!['id', 'firestoreId', 'tags', 'isMember', 'image'].includes(key)) {
        delete cleanedMember[key];
      }
    }
  });
  
  emit("update", cleanedMember);
};

const handleDelete = () => {
  emit("delete", props.member);
};

const handleViewPage = () => {
  const id = props.member?.firestoreId || props.member?.id;
  if (id) {
    router.push(`/members/${id}`);
  }
};

const handleEdit = () => {
  isEditMode.value = true;
};

const handleDoneEditing = () => {
  isEditMode.value = false;
};

const showImageCropper = ref(false);

const handleImageUpdate = (base64Image) => {
  handleFieldSave('image', base64Image);
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
  <Teleport to="body" :disabled="!isMobile">
    <Transition :name="isMobile ? 'modal-sheet' : 'drawer'">
      <div
        v-if="showDetails"
        :class="[
          isMobile
            ? 'fixed inset-0 z-[60] flex flex-col justify-end'
            : 'member-details-drawer m-3 rounded-2xl border-2 border-primary/30 dark:border-primary-light/30 bg-white dark:bg-gray-800 w-[calc(50%-1.5rem)] h-[calc(100%-1.5rem)] flex flex-col shrink-0 shadow-xl shadow-primary/25 dark:shadow-primary-light/20'
        ]"
      >
        <div
          v-if="isMobile"
          class="absolute inset-0 bg-black/50"
          @click="$emit('update:showDetails', false)"
        />

        <div
          :class="[
            'flex flex-col min-h-0',
            isMobile
              ? 'relative z-10 w-full max-h-[92dvh] rounded-t-2xl bg-white dark:bg-gray-800 shadow-2xl border-t border-gray-200 dark:border-gray-700'
              : 'h-full w-full'
          ]"
        >
      <!-- Header -->
      <div class="shrink-0 bg-linear-to-r from-primary/10 to-transparent dark:from-primary-light/10 dark:to-transparent rounded-t-2xl border-b border-primary/20 dark:border-primary-light/20 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ isEditMode ? 'Edit Member' : 'Member Details' }}
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {{ isEditMode ? 'All fields are editable' : 'Double-click any field to edit' }}
          </p>
        </div>
        <button
          @click="$emit('update:showDetails', false)"
          class="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <!-- Loading Skeleton -->
      <div v-if="loading || !member" class="flex-1 overflow-y-auto p-5">
        <div class="flex items-center gap-4 pb-5 mb-5 border-b border-gray-200 dark:border-gray-700">
          <div class="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
          <div class="flex-1 space-y-2">
            <div class="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div class="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div class="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
          </div>
        </div>
        <div class="space-y-4">
          <div class="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <div class="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div class="h-5 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
            <div class="space-y-1">
              <div class="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div class="h-5 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <div class="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div class="h-5 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
            <div class="space-y-1">
              <div class="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div class="h-5 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
          </div>
          <div class="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-6"></div>
          <div class="space-y-1">
            <div class="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div class="h-16 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <div class="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div class="h-5 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
            <div class="space-y-1">
              <div class="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div class="h-5 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Scrollable Content -->
      <div v-else class="flex-1 overflow-y-auto p-5">
        <!-- Profile Section -->
        <div class="flex items-center gap-4 pb-5 mb-5 border-b border-gray-200 dark:border-gray-700">
          <div class="relative group">
            <img
              :src="getAvatarUrl(localMember)"
              :alt="getFullName(localMember)"
              class="h-16 w-16 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
            />
            <button
              @click="showImageCropper = true"
              class="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ImageIcon class="h-5 w-5 text-white" />
            </button>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {{ getFullName(localMember) }}
              </h2>
              <span :class="['text-lg', getSexIconColor(localMember.sex)]" :title="localMember.sex">
                {{ getSexIcon(localMember.sex) }}
              </span>
            </div>
            <p v-if="localMember.nickname" class="text-sm text-gray-500 dark:text-gray-400 truncate">
              "{{ localMember.nickname }}"
            </p>
          </div>
        </div>

        <!-- Editable Fields - Grouped Sections -->
        <div class="space-y-6">
          
          <!-- Personal Information Section -->
          <section class="space-y-4">
            <h4 class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <User class="h-3.5 w-3.5" />
              Personal Information
            </h4>
            <div class="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 space-y-4">
              <!-- Name Fields -->
              <div class="grid grid-cols-2 gap-4">
                <InlineEditField
                  v-model="localMember.firstName"
                  label="First Name"
                  type="text"
                  :forceEdit="isEditMode"
                  @save="handleFieldSave('firstName', $event)"
                />
                <InlineEditField
                  v-model="localMember.lastName"
                  label="Last Name"
                  type="text"
                  :forceEdit="isEditMode"
                  @save="handleFieldSave('lastName', $event)"
                />
              </div>

              <!-- Nickname, Gender -->
              <div class="grid grid-cols-2 gap-4">
                <InlineEditField
                  v-model="localMember.nickname"
                  label="Nickname"
                  type="text"
                  emptyText="None"
                  :forceEdit="isEditMode"
                  @save="handleFieldSave('nickname', $event)"
                />
                <InlineEditField
                  v-model="localMember.sex"
                  label="Gender"
                  type="select"
                  :options="sexOptions"
                  :forceEdit="isEditMode"
                  @save="handleFieldSave('sex', $event)"
                />
              </div>

              <!-- Civil Status, Date of Birth -->
              <div class="grid grid-cols-2 gap-4">
                <InlineEditField
                  v-model="localMember.civilStatus"
                  label="Civil Status"
                  type="select"
                  :options="civilStatusOptions"
                  :forceEdit="isEditMode"
                  @save="handleFieldSave('civilStatus', $event)"
                />
                <InlineEditField
                  v-model="localMember.dateOfBirth"
                  label="Date of Birth"
                  type="date"
                  :displayFormatter="(val) => val ? `${new Date(val).toLocaleDateString()}${localMember.age ? ` (${localMember.age} yrs)` : ''}` : null"
                  :forceEdit="isEditMode"
                  @save="handleFieldSave('dateOfBirth', $event)"
                />
              </div>
            </div>
          </section>

          <!-- Contact Information Section -->
          <section class="space-y-4">
            <h4 class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Phone class="h-3.5 w-3.5" />
              Contact Information
            </h4>
            <div class="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 space-y-4">
              <InlineEditField
                v-model="localMember.contactNumber"
                label="Phone Number"
                type="tel"
                :forceEdit="isEditMode"
                @save="handleFieldSave('contactNumber', $event)"
              />
              <InlineEditField
                v-model="localMember.address"
                label="Address"
                type="textarea"
                :forceEdit="isEditMode"
                @save="handleFieldSave('address', $event)"
              />
            </div>
          </section>

          <!-- Work & Church Section -->
          <section class="space-y-4">
            <h4 class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Briefcase class="h-3.5 w-3.5" />
              Work & Church
            </h4>
            <div class="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 space-y-4">
              <InlineEditField
                v-model="localMember.occupation"
                label="Occupation"
                type="text"
                :forceEdit="isEditMode"
                @save="handleFieldSave('occupation', $event)"
              />
              <InlineEditField
                v-model="localMember.tags"
                label="Ministry Tags"
                type="tags"
                emptyText="No tags assigned"
                :allTags="allTags"
                :forceEdit="isEditMode"
                @save="handleFieldSave('tags', $event)"
              />
              
              <!-- Member Status Toggle -->
              <div class="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                <div>
                  <p class="text-sm font-medium text-gray-900 dark:text-white">Church Member</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Official membership status</p>
                </div>
                <button
                  @click="handleFieldSave('isMember', !localMember.isMember)"
                  :class="[
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                    localMember.isMember ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  ]"
                >
                  <span
                    :class="[
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
                      localMember.isMember ? 'translate-x-6' : 'translate-x-1'
                    ]"
                  ></span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <!-- Footer -->
      <div class="shrink-0 bg-linear-to-r from-primary/10 to-transparent dark:from-primary-light/10 dark:to-transparent rounded-b-2xl border-t border-primary/20 dark:border-primary-light/20 px-6 py-4">
        <div class="flex justify-end gap-2">
          <button
            @click="handleViewPage"
            class="p-2 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shadow-lg shadow-gray-400/25 dark:shadow-gray-900/25"
            title="View Full Page"
          >
            <ExternalLink class="h-5 w-5" />
          </button>
          <button
            v-if="isEditMode"
            @click="handleDoneEditing"
            class="px-4 py-2 text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 shadow-lg shadow-green-500/25"
            title="Done Editing"
          >
            <Check class="h-4 w-4" />
            <span class="text-sm font-medium">Done</span>
          </button>
          <button
            v-else
            @click="handleEdit"
            class="p-2 text-white bg-primary dark:bg-primary-light rounded-lg hover:bg-primary-hover dark:hover:bg-[#1a9aab] transition-colors shadow-lg shadow-primary/25 dark:shadow-primary-light/25"
            title="Edit All Fields"
          >
            <Edit2 class="h-5 w-5" />
          </button>
          <button
            @click="handleDelete"
            class="p-2 text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors shadow-lg shadow-red-500/25"
            title="Delete"
          >
            <Trash2 class="h-5 w-5" />
          </button>
        </div>
      </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Image Cropper -->
  <ImageCropper
    v-model:show="showImageCropper"
    v-model="localMember.image"
    @update:modelValue="handleImageUpdate"
  />
</template>

<style>
.member-details-drawer {
  transition: max-width 0.3s ease-out, opacity 0.3s ease;
}

.drawer-enter-from.member-details-drawer,
.drawer-leave-to.member-details-drawer {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
}

.modal-sheet-enter-active,
.modal-sheet-leave-active {
  transition: opacity 0.25s ease;
}

.modal-sheet-enter-active > div:last-child,
.modal-sheet-leave-active > div:last-child {
  transition: transform 0.25s ease;
}

.modal-sheet-enter-from,
.modal-sheet-leave-to {
  opacity: 0;
}

.modal-sheet-enter-from > div:last-child,
.modal-sheet-leave-to > div:last-child {
  transform: translateY(100%);
}
</style>
