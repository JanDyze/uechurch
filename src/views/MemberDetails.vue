<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Trash2, Calendar, MapPin, Phone, Briefcase, Users, Tag, User, Image as ImageIcon } from 'lucide-vue-next'
import { useMembers } from '../composables/useMembers'
import { getFullName, getAvatarUrl, getSexIcon, getSexIconColor, calculateAgeFromDate } from '../utils/memberUtils'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'
import ImageCropper from '../components/members/ImageCropper.vue'
import InlineEditField from '../components/common/InlineEditField.vue'

const route = useRoute()
const router = useRouter()
const { members, loading, updateMemberInFirestore, removeMember } = useMembers()

const showImageCropper = ref(false)

// Get member from route param
const member = computed(() => {
  const id = route.params.id
  return members.value.find(m => 
    String(m.id) === String(id) || 
    String(m.firestoreId) === String(id)
  )
})

// Local copy for editing
const localMember = ref({})

watch(member, (newMember) => {
  if (newMember) {
    localMember.value = { ...newMember }
  }
}, { immediate: true, deep: true })

// Get all unique tags
const allTags = computed(() => {
  const tags = new Set()
  members.value.forEach(m => {
    if (m.tags) m.tags.forEach(t => tags.add(t))
  })
  return Array.from(tags).sort()
})

// Confirmation modal
const showConfirmation = ref(false)
const confirmationConfig = ref({
  title: 'Confirm Action',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  confirmButtonClass: 'bg-[#01779b] text-white hover:bg-[#015a77]',
  onConfirm: null
})

const showConfirmModal = (config) => {
  confirmationConfig.value = { ...confirmationConfig.value, ...config }
  showConfirmation.value = true
}

const handleConfirmation = () => {
  if (confirmationConfig.value.onConfirm) {
    confirmationConfig.value.onConfirm()
  }
}

// Handle field save - immediately update
const handleFieldSave = async (field, value) => {
  localMember.value[field] = value
  
  // Calculate age if date of birth changed
  if (field === 'dateOfBirth' && value) {
    localMember.value.age = calculateAgeFromDate(value)
  }
  
  try {
    const { id, firestoreId, ...dataToUpdate } = localMember.value
    
    // Clean up undefined values
    Object.keys(dataToUpdate).forEach(key => {
      if (dataToUpdate[key] === undefined || dataToUpdate[key] === '') {
        if (!['tags', 'isMember', 'image'].includes(key)) {
          delete dataToUpdate[key]
        }
      }
    })
    
    await updateMemberInFirestore(member.value, dataToUpdate)
  } catch (error) {
    console.error('Error updating member:', error)
  }
}

const handleDelete = () => {
  showConfirmModal({
    title: 'Delete Member',
    message: `Are you sure you want to delete ${getFullName(member.value)}? This action cannot be undone.`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    confirmButtonClass: 'bg-red-600 text-white hover:bg-red-700',
    onConfirm: async () => {
      try {
        await removeMember(member.value)
        router.push('/members')
      } catch (error) {
        console.error('Error deleting member:', error)
      }
    }
  })
}

const handleImageUpdate = (base64Image) => {
  handleFieldSave('image', base64Image)
}

// Options for select fields
const sexOptions = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
]

const civilStatusOptions = [
  { value: 'Single', label: 'Single' },
  { value: 'Married', label: 'Married' },
  { value: 'Widowed', label: 'Widowed' },
  { value: 'Separated', label: 'Separated' },
]

</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <button
        @click="router.push('/members')"
        class="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft class="h-5 w-5" />
        <span>Back to Members</span>
      </button>
      
      <div v-if="member" class="flex items-center gap-2">
        <span class="text-xs text-gray-500 dark:text-gray-400 mr-2">Changes save automatically</span>
        <button
          @click="handleDelete"
          class="p-2 text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
          title="Delete Member"
        >
          <Trash2 class="h-5 w-5" />
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-[#01779b]"></div>
    </div>

    <!-- Not Found -->
    <div v-else-if="!member" class="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
      <Users class="h-16 w-16 mb-4 opacity-50" />
      <p class="text-lg">Member not found</p>
      <button
        @click="router.push('/members')"
        class="mt-4 px-4 py-2 bg-[#01779b] text-white rounded-lg hover:bg-[#015a77] transition-colors"
      >
        Back to Members
      </button>
    </div>

    <!-- Member Content with Inline Editing -->
    <div v-else class="flex-1 overflow-y-auto">
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <!-- Profile Header -->
        <div class="p-8 bg-gradient-to-br from-[#01779b]/10 via-[#01779b]/5 to-transparent dark:from-[#22b8cf]/15 dark:via-[#22b8cf]/5">
          <div class="flex items-start gap-6">
            <!-- Avatar with edit overlay -->
            <div class="relative group">
              <img
                :src="getAvatarUrl(localMember)"
                :alt="getFullName(localMember)"
                class="h-28 w-28 rounded-2xl border-4 border-white dark:border-gray-700 shadow-xl object-cover"
              />
              <button
                @click="showImageCropper = true"
                class="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <div class="text-center">
                  <ImageIcon class="h-6 w-6 text-white mx-auto mb-1" />
                  <span class="text-xs text-white">Change</span>
                </div>
              </button>
            </div>
            
            <div class="flex-1 pt-2">
              <div class="flex items-center gap-3 mb-2">
                <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
                  {{ getFullName(localMember) }}
                </h1>
                <span :class="['text-3xl', getSexIconColor(localMember.sex)]">
                  {{ getSexIcon(localMember.sex) }}
                </span>
              </div>
              <p v-if="localMember.nickname" class="text-lg text-gray-500 dark:text-gray-400 mb-3">
                "{{ localMember.nickname }}"
              </p>
              <div class="flex items-center gap-2 flex-wrap">
                <span
                  :class="[
                    'px-3 py-1.5 text-sm font-medium rounded-full',
                    localMember.isMember 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  ]"
                >
                  {{ localMember.isMember ? 'Church Member' : 'Non-Member' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Editable Fields -->
        <div class="p-6">
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-6 flex items-center gap-2">
            <span class="inline-block w-2 h-2 rounded-full bg-[#01779b] dark:bg-[#22b8cf] animate-pulse"></span>
            Double-click any field to edit
          </p>
          
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- Left Column - Personal Information -->
            <section class="space-y-5">
              <h3 class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <User class="h-3.5 w-3.5" />
                Personal Information
              </h3>
              
              <div class="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-5 space-y-5">
                <!-- Name Fields -->
                <div class="grid grid-cols-2 gap-4">
                  <InlineEditField
                    v-model="localMember.firstName"
                    label="First Name"
                    type="text"
                    @save="handleFieldSave('firstName', $event)"
                  />
                  <InlineEditField
                    v-model="localMember.lastName"
                    label="Last Name"
                    type="text"
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
                    @save="handleFieldSave('nickname', $event)"
                  />
                  <InlineEditField
                    v-model="localMember.sex"
                    label="Gender"
                    type="select"
                    :options="sexOptions"
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
                    @save="handleFieldSave('civilStatus', $event)"
                  />
                  <InlineEditField
                    v-model="localMember.dateOfBirth"
                    label="Date of Birth"
                    type="date"
                    :displayFormatter="(val) => val ? `${new Date(val).toLocaleDateString()}${localMember.age ? ` (${localMember.age} years)` : ''}` : null"
                    @save="handleFieldSave('dateOfBirth', $event)"
                  />
                </div>
              </div>
            </section>

            <!-- Right Column - Contact & Church -->
            <section class="space-y-5">
              <h3 class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Phone class="h-3.5 w-3.5" />
                Contact & Church
              </h3>
              
              <div class="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-5 space-y-5">
                <InlineEditField
                  v-model="localMember.contactNumber"
                  label="Phone Number"
                  type="tel"
                  @save="handleFieldSave('contactNumber', $event)"
                />
                
                <InlineEditField
                  v-model="localMember.address"
                  label="Address"
                  type="textarea"
                  @save="handleFieldSave('address', $event)"
                />
                
                <InlineEditField
                  v-model="localMember.occupation"
                  label="Occupation"
                  type="text"
                  @save="handleFieldSave('occupation', $event)"
                />
                
                <InlineEditField
                  v-model="localMember.tags"
                  label="Ministry Tags"
                  type="tags"
                  emptyText="No tags assigned"
                  :allTags="allTags"
                  @save="handleFieldSave('tags', $event)"
                />
              </div>
            </section>
          </div>

          <!-- Member Status Toggle -->
          <div class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between p-5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800/50">
              <div class="flex items-center gap-4">
                <div class="p-3 bg-green-100 dark:bg-green-900/50 rounded-xl">
                  <Users class="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p class="font-semibold text-gray-900 dark:text-white">Church Membership</p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">Official church member status</p>
                </div>
              </div>
              <button
                @click="handleFieldSave('isMember', !localMember.isMember)"
                :class="[
                  'relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2',
                  localMember.isMember ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                ]"
              >
                <span
                  :class="[
                    'inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-md',
                    localMember.isMember ? 'translate-x-7' : 'translate-x-1'
                  ]"
                ></span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirmation Modal -->
    <ConfirmationModal
      :show="showConfirmation"
      :title="confirmationConfig.title"
      :message="confirmationConfig.message"
      :confirm-text="confirmationConfig.confirmText"
      :cancel-text="confirmationConfig.cancelText"
      :confirm-button-class="confirmationConfig.confirmButtonClass"
      @update:show="showConfirmation = $event"
      @confirm="handleConfirmation"
      @cancel="showConfirmation = false"
    />

    <!-- Image Cropper -->
    <ImageCropper
      v-model:show="showImageCropper"
      v-model="localMember.image"
      @update:modelValue="handleImageUpdate"
    />
  </div>
</template>
