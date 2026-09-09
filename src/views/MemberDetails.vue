<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertCircle, ArrowLeft, Check, Edit2, Trash2, Calendar, MapPin, Phone, Briefcase, Users, Tag, User, Image as ImageIcon } from '../icons'
import { useMembers } from '../composables/useMembers'
import { getFullName, getSexIcon, getSexIconColor, calculateAgeFromDate, mergeTagSources, missingMemberFields, CIVIL_STATUS_OPTIONS as civilStatusOptions } from '../utils/memberUtils'
import { subscribeToCustomTags } from '../api/tagsService'
import MemberAvatar from '../components/members/MemberAvatar.vue'
import YouBadge from '../components/members/YouBadge.vue'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'
import ImageCropper from '../components/members/ImageCropper.vue'
import { uploadImage } from '../api/blobService'
import { useToast } from '../composables/useToast'
import InlineEditField from '../components/common/InlineEditField.vue'

// The list can only say a record is thin. Here there is room to say which
// parts, so the person looking at it knows what to ask for.
const gaps = computed(() => (localMember.value ? missingMemberFields(localMember.value) : []))

// The record is edited as a record. Per-field pencils asked which field you
// meant before you had decided you were editing anything.
const isEditMode = ref(false)

/**
 * What the record says, grouped and in plain language.
 *
 * Reading and editing want different shapes. A form is a column of one field
 * per row because every field needs a control; a record is not — "12 March
 * 1990 · 35 · Female · Single" is one fact about a person and belongs on one
 * line. The two-column grid of boxed rows was the form's shape borrowed for
 * reading, which is why it took a screen and a half to say very little.
 *
 * Empty values are kept and shown greyed rather than dropped: a record you can
 * see the holes in is the point, and the banner above only counts them.
 */
const fmtDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

const factGroups = computed(() => {
  const m = localMember.value || {}
  const age = calculateAgeFromDate(m.dateOfBirth)
  return [
    {
      key: 'personal',
      label: 'Personal',
      icon: User,
      lines: [
        [
          { text: fmtDate(m.dateOfBirth), missing: 'Birthday not set' },
          { text: age !== undefined ? `${age} years old` : '' },
          { text: m.sex, missing: 'Sex not set' },
          { text: m.civilStatus },
        ],
        [{ text: m.nickname ? `Goes by “${m.nickname}”` : '' }],
      ],
    },
    {
      key: 'contact',
      label: 'Contact',
      icon: Phone,
      lines: [
        [{ text: m.contactNumber, missing: 'No contact number' }],
        [{ text: m.address, missing: 'No address' }],
        [{ text: m.occupation, missing: 'No occupation recorded' }],
      ],
    },
  ]
})

/** Drop the empties a line would otherwise render as stray separators. */
const shownParts = (parts) => parts.filter((p) => p.text || p.missing)

const route = useRoute()
const router = useRouter()
const { members, loading, updateMemberInFirestore, removeMember } = useMembers()

// Custom tags created from the Members page toolbar's "Add tag" control
const customTags = ref([])
let unsubscribeCustomTags = null

onMounted(() => {
  unsubscribeCustomTags = subscribeToCustomTags((tags) => {
    customTags.value = tags.map((t) => t.name)
  })
})

onUnmounted(() => {
  if (unsubscribeCustomTags) unsubscribeCustomTags()
})

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
  return mergeTagSources(Array.from(tags), customTags.value)
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

const toast = useToast()

// The cropper hands back a full-quality PNG data URL. It goes to Blob storage
// and the record keeps only the URL — a data URL is never written to Firestore.
const handleImageUpdate = async (base64Image) => {
  if (!base64Image) {
    handleFieldSave('image', null)
    return
  }
  try {
    handleFieldSave('image', await uploadImage(base64Image, 'members'))
  } catch (error) {
    console.error('Error storing that photo:', error)
    toast.error('Could not save that photo. Please try again.')
  }
}

// Options for select fields
const sexOptions = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
]


</script>

<template>
  <!-- A focus route gets the raw box, so the padding and the safe areas are
       this page's own - there is no layout chrome left to provide them. -->
  <div
    class="h-full flex flex-col px-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)] sm:px-4 lg:px-8 lg:pt-3"
  >
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <button
        @click="router.push('/members')"
        class="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft class="h-5 w-5" />
        <span>Back to People</span>
      </button>
      
      <div v-if="member" class="flex items-center gap-2">
        <span
          v-if="isEditMode"
          class="hidden text-xs text-gray-500 dark:text-gray-400 mr-1 sm:inline"
        >
          Changes save as you make them
        </span>
        <button
          @click="isEditMode = !isEditMode"
          :aria-label="isEditMode ? 'Done editing' : 'Edit this record'"
          :title="isEditMode ? 'Done' : 'Edit'"
          :class="[
            'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isEditMode
              ? 'bg-primary text-white hover:bg-primary-hover'
              : 'border border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700',
          ]"
        >
          <Check v-if="isEditMode" class="h-4 w-4" />
          <Edit2 v-else class="h-4 w-4" />
          {{ isEditMode ? 'Done' : 'Edit' }}
        </button>
        <button
          @click="handleDelete"
          class="p-2 text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
          title="Delete"
          aria-label="Delete this person"
        >
          <Trash2 class="h-5 w-5" />
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <!-- Not Found -->
    <div v-else-if="!member" class="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
      <Users class="h-16 w-16 mb-4 opacity-50" />
      <p class="text-lg">Member not found</p>
      <button
        @click="router.push('/members')"
        class="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
      >
        Back to People
      </button>
    </div>

    <!-- Member Content with Inline Editing -->
    <div v-else class="flex-1 overflow-y-auto">
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <!-- What is still missing. Above the record rather than beside each
             field: the point is to be told before reading, so you know what to
             ask for while the person is still in front of you. -->
        <div
          v-if="gaps.length"
          class="flex items-start gap-2.5 border-b border-amber-200 bg-amber-50 px-6 py-3 dark:border-amber-500/25 dark:bg-amber-500/10"
        >
          <AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
          <div class="min-w-0 flex-1">
            <p class="text-xs font-bold text-amber-800 dark:text-amber-300">
              {{ gaps.length }} {{ gaps.length === 1 ? 'detail is' : 'details are' }} still missing
            </p>
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              <span
                v-for="gap in gaps"
                :key="gap.key"
                class="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
              >
                {{ gap.label }}
              </span>
            </div>
          </div>
        </div>

        <!-- Profile Header -->
        <div class="p-8 bg-linear-to-br from-primary/10 via-primary/5 to-transparent dark:from-primary-light/15 dark:via-primary-light/5">
          <div class="flex items-start gap-6">
            <!-- Avatar with edit overlay -->
            <MemberAvatar
              :member="localMember"
              size="h-28 w-28"
              plain-class="border-4 border-white dark:border-gray-700 shadow-xl"
              class="group"
            >
              <button
                @click="showImageCropper = true"
                class="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <div class="text-center">
                  <ImageIcon class="h-6 w-6 text-white mx-auto mb-1" />
                  <span class="text-xs text-white">Change</span>
                </div>
              </button>
            </MemberAvatar>
            
            <div class="flex-1 pt-2">
              <div class="flex items-center gap-3 mb-2">
                <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
                  {{ getFullName(localMember) }}
                </h1>
                <span :class="['text-3xl', getSexIconColor(localMember.sex)]">
                  {{ getSexIcon(localMember.sex) }}
                </span>
                <YouBadge :member="localMember" />
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
          <!-- Reading: the record as prose-shaped facts, grouped, one column,
               related things on the same line. -->
          <div v-if="!isEditMode" class="space-y-6">
            <section v-for="group in factGroups" :key="group.key">
              <h3
                class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500"
              >
                <component :is="group.icon" class="h-3.5 w-3.5" />
                {{ group.label }}
              </h3>
              <div class="space-y-1.5 pl-5.5">
                <p
                  v-for="(line, i) in group.lines"
                  :key="i"
                  class="text-sm"
                >
                  <template v-for="(part, j) in shownParts(line)" :key="j">
                    <span v-if="j" class="px-1.5 text-gray-300 dark:text-gray-600">·</span>
                    <span
                      :class="part.text ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'"
                    >
                      {{ part.text || part.missing }}
                    </span>
                  </template>
                </p>
              </div>
            </section>

            <!-- Ministries and tags keep their chips: a list of names is not a
                 sentence, and reads faster as the things it is. -->
            <section>
              <h3
                class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500"
              >
                <Tag class="h-3.5 w-3.5" />
                Church
              </h3>
              <div class="space-y-2 pl-5.5">
                <p class="text-sm text-gray-900 dark:text-white">
                  {{ localMember.isMember ? 'Church member' : 'Attendee' }}
                </p>
                <div v-if="(localMember.tags || []).length" class="flex flex-wrap gap-1.5">
                  <span
                    v-for="tag in localMember.tags"
                    :key="tag"
                    class="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary dark:bg-primary-light/20 dark:text-primary-light"
                  >
                    {{ tag }}
                  </span>
                </div>
                <p v-else class="text-sm text-gray-400 dark:text-gray-500">No tags assigned</p>
              </div>
            </section>
          </div>

          <!-- Editing: one control per field, which is what a form is for. -->
          <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                    :forceEdit="isEditMode"
                    v-model="localMember.firstName"
                    label="First Name"
                    type="text"
                    @save="handleFieldSave('firstName', $event)"
                  />
                  <InlineEditField
                    :forceEdit="isEditMode"
                    v-model="localMember.lastName"
                    label="Last Name"
                    type="text"
                    @save="handleFieldSave('lastName', $event)"
                  />
                </div>
                
                <!-- Nickname, Gender -->
                <div class="grid grid-cols-2 gap-4">
                  <InlineEditField
                    :forceEdit="isEditMode"
                    v-model="localMember.nickname"
                    label="Nickname"
                    type="text"
                    emptyText="None"
                    @save="handleFieldSave('nickname', $event)"
                  />
                  <InlineEditField
                    :forceEdit="isEditMode"
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
                    :forceEdit="isEditMode"
                    v-model="localMember.civilStatus"
                    label="Civil Status"
                    type="select"
                    :options="civilStatusOptions"
                    @save="handleFieldSave('civilStatus', $event)"
                  />
                  <InlineEditField
                    :forceEdit="isEditMode"
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
                    :forceEdit="isEditMode"
                  v-model="localMember.contactNumber"
                  label="Phone Number"
                  type="tel"
                  @save="handleFieldSave('contactNumber', $event)"
                />
                
                <InlineEditField
                    :forceEdit="isEditMode"
                  v-model="localMember.address"
                  label="Address"
                  type="textarea"
                  @save="handleFieldSave('address', $event)"
                />
                
                <InlineEditField
                    :forceEdit="isEditMode"
                  v-model="localMember.occupation"
                  label="Occupation"
                  type="text"
                  @save="handleFieldSave('occupation', $event)"
                />
                
                <InlineEditField
                    :forceEdit="isEditMode"
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
            <div class="flex items-center justify-between p-5 bg-linear-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800/50">
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
                aria-label="Church Membership"
                :aria-pressed="localMember.isMember"
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
      <!-- :modelValue, not v-model. v-model registers a second listener that
           writes the cropper's base64 straight into the record, racing the
           upload beside it and winning whenever the upload fails. The handler
           is the only thing allowed to set this field. -->
    <ImageCropper
      v-model:show="showImageCropper"
      :modelValue="localMember.image"
      @update:modelValue="handleImageUpdate"
    />
  </div>
</template>
