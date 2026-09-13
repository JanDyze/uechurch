<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Camera,
  ChatCircleText,
  Check,
  Church,
  Edit2,
  Gift,
  Mail,
  MapPin,
  Phone,
  Tag,
  Trash2,
  User,
  Users,
} from '../icons'
import { useMembers } from '../composables/useMembers'
import { useMinistries } from '../composables/useMinistries'
import { usePermissions } from '../composables/usePermissions'
import { useMemberAttendance } from '../composables/useMemberAttendance'
import {
  getFullName,
  getSexIcon,
  getSexIconColor,
  calculateAgeFromDate,
  mergeTagSources,
  missingMemberFields,
  CIVIL_STATUS_OPTIONS as civilStatusOptions,
} from '../utils/memberUtils'
import { subscribeToCustomTags } from '../api/tagsService'
import MemberAvatar from '../components/members/MemberAvatar.vue'
import YouBadge from '../components/members/YouBadge.vue'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'
import ImageCropper from '../components/members/ImageCropper.vue'
import InlineEditField from '../components/common/InlineEditField.vue'
import { uploadImage } from '../api/blobService'
import { useToast } from '../composables/useToast'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { members, loading, updateMemberInFirestore, removeMember } = useMembers()
const { ministryNames } = useMinistries()

// A ministry grants access, so editing this record is a manage capability even
// though reading it is not. The route only asks for members.view, which is why
// the gate has to be here rather than in the router.
const { canManage } = usePermissions()
const canEdit = computed(() => canManage('members'))

// The record is edited as a record. Per-field pencils asked which field you
// meant before you had decided you were editing anything.
const isEditMode = ref(false)
const showImageCropper = ref(false)

// The bar only says the name once the heading carrying it has scrolled past,
// so the first screen does not print it twice.
const scrolled = ref(false)
const onScroll = (e) => {
  scrolled.value = e.target.scrollTop > 72
}

const member = computed(() => {
  const id = route.params.id
  return members.value.find(
    (m) => String(m.id) === String(id) || String(m.firestoreId) === String(id)
  )
})

const localMember = ref({})

watch(
  member,
  (newMember) => {
    if (newMember) localMember.value = { ...newMember }
  },
  { immediate: true, deep: true }
)

// Custom tags created from the People page toolbar's "Add tag" control
const customTags = ref([])
let unsubscribeCustomTags = null

onMounted(() => {
  unsubscribeCustomTags = subscribeToCustomTags((tags) => {
    customTags.value = tags.map((t) => t.name)
  })

  // "Edit" on the People list's context menu arrives as ?edit=1. It is consumed
  // once and dropped from the URL: it says how you got here, not what the
  // record is, so a refresh or a back-and-forward should not re-open the form.
  if (route.query.edit === '1' && canEdit.value) {
    isEditMode.value = true
    router.replace({ path: route.path, query: {} })
  }
})

onUnmounted(() => {
  if (unsubscribeCustomTags) unsubscribeCustomTags()
})

const allTags = computed(() => {
  const tags = new Set()
  members.value.forEach((m) => {
    if (m.tags) m.tags.forEach((t) => tags.add(t))
  })
  return mergeTagSources(Array.from(tags), customTags.value)
})

// The list can only say a record is thin. Here there is room to say which
// parts, so the person looking at it knows what to ask for.
const gaps = computed(() => (localMember.value ? missingMemberFields(localMember.value) : []))

/* ------------------------------------------------------------- attendance */
const { history, byMonth, counted, presentCount, unrecordedCount } =
  useMemberAttendance(localMember)

const ATTENDANCE_STYLE = {
  present: 'bg-green-500 dark:bg-green-500',
  absent: 'bg-red-400 dark:bg-red-500',
  unrecorded:
    'bg-transparent border border-dashed border-gray-300 dark:border-gray-600',
}

const stateWord = { present: 'Came', absent: 'Did not come', unrecorded: 'Not recorded' }

/** Just the day — the month is already the heading above it. */
const dayOf = (iso) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : String(d.getDate())
}

/* ----------------------------------------------------------------- record */
const sexOptions = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
]

const fmtDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

const age = computed(() => calculateAgeFromDate(localMember.value?.dateOfBirth))

/** A number a phone can actually dial: digits and a leading +, nothing else. */
const dialable = (value) => {
  const cleaned = String(value || '').replace(/[^\d+]/g, '')
  return cleaned.length >= 4 ? cleaned : ''
}

/**
 * The sign beside the name, in the blue and pink the avatar ring already uses.
 * `getSexIcon` answers "♀" for anything that is not "Male" — blanks included —
 * so it is only asked once the record actually says.
 */
const sexMark = computed(() => {
  const sex = localMember.value?.sex
  if (sex !== 'Male' && sex !== 'Female') return null
  return { glyph: getSexIcon(sex), color: getSexIconColor(sex), label: sex }
})

/**
 * The next birthday, said the way you would say it.
 *
 * A countdown is only worth reading while it is short. "361 days" under the
 * word "Birthday" parses as a number of birthdays before it parses as a wait,
 * and by then you have read it twice. So a birthday that is close counts down
 * and a birthday that is far off just gives the date, which is what you were
 * going to ask for anyway.
 */
const nextBirthday = computed(() => {
  const iso = localMember.value?.dateOfBirth
  if (!iso) return null
  const dob = new Date(iso)
  if (Number.isNaN(dob.getTime())) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate())
  if (next < today) next.setFullYear(next.getFullYear() + 1)

  const days = Math.round((next - today) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days <= 30) return `In ${days} days`
  return next.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
})

/** Of the gatherings a register was kept for, how many they came to. */
const attendanceRate = computed(() => {
  if (!counted.value.length) return null
  return Math.round((presentCount.value / counted.value.length) * 100)
})

/**
 * What goes where the cover photo was. Only the ones that have something to
 * say are drawn, so a thin record gets a short row rather than a row of
 * zeroes and dashes.
 */
const headlineStats = computed(() => {
  const out = []
  if (attendanceRate.value !== null) {
    out.push({
      key: 'attendance',
      value: `${attendanceRate.value}%`,
      label: 'Attendance',
    })
  }
  const ministries = (localMember.value?.ministries || []).length
  if (ministries) {
    out.push({
      key: 'ministries',
      value: ministries,
      label: ministries === 1 ? 'Ministry' : 'Ministries',
    })
  }
  if (nextBirthday.value) {
    out.push({ key: 'birthday', value: nextBirthday.value, label: 'Birthday' })
  }
  return out
})

/**
 * The line under the name — nickname, standing, age, all the things that were
 * separate chips and separate rows before. Saying "Member" in a chip, again in
 * a Church row and a third time on a toggle is three chances to disagree.
 */
const introParts = computed(() => {
  const m = localMember.value || {}
  const parts = []
  if (m.nickname) parts.push(`“${m.nickname}”`)
  parts.push(m.isMember ? 'Church member' : 'Attendee')
  if (age.value !== undefined) parts.push(`${age.value} years old`)
  return parts
})

/**
 * What you came here to do. A directory read on a phone is opened to reach
 * somebody; the number used to be plain text you read out to yourself and
 * retyped into the dialler.
 */
const contactActions = computed(() => {
  const m = localMember.value || {}
  const tel = dialable(m.contactNumber)
  const out = []
  if (tel) {
    out.push({ key: 'call', label: 'Call', icon: Phone, href: `tel:${tel}` })
    out.push({ key: 'text', label: 'Text', icon: ChatCircleText, href: `sms:${tel}` })
  }
  if (m.email) out.push({ key: 'email', label: 'Email', icon: Mail, href: `mailto:${m.email}` })
  return out
})

/**
 * About, in the shape a profile reads in: an icon and the fact, no column of
 * grey captions repeating what the icon already says. Related facts share a
 * line — "Female · Single" is one thing you know about somebody.
 *
 * Nickname, standing and age are deliberately absent: they are in the intro
 * line above, and this is the same page.
 */
const about = computed(() => {
  const m = localMember.value || {}
  return [
    { key: 'dateOfBirth', icon: Gift, text: fmtDate(m.dateOfBirth), missing: 'Birthday not set' },
    {
      key: 'sex',
      icon: User,
      // Same blue and pink as the mark beside the name, so the two agree.
      iconClass: m.sex === 'Male' || m.sex === 'Female' ? getSexIconColor(m.sex) : '',
      text: [m.sex, m.civilStatus].filter(Boolean).join(' · '),
      missing: 'Sex not set',
    },
    { key: 'occupation', icon: Briefcase, text: m.occupation, missing: 'No occupation recorded' },
    { key: 'contactNumber', icon: Phone, text: m.contactNumber, missing: 'No contact number' },
    { key: 'email', icon: Mail, text: m.email, missing: 'No email' },
    { key: 'address', icon: MapPin, text: m.address, missing: 'No address' },
  ]
})

/** The same fields as controls, plus the ones that only make sense to edit. */
const editFields = computed(() => [
  { key: 'firstName', label: 'First name', type: 'text' },
  { key: 'lastName', label: 'Last name', type: 'text' },
  { key: 'nickname', label: 'Nickname', type: 'text' },
  { key: 'dateOfBirth', label: 'Date of birth', type: 'date' },
  { key: 'sex', label: 'Sex', type: 'select', options: sexOptions },
  { key: 'civilStatus', label: 'Civil status', type: 'select', options: civilStatusOptions },
  { key: 'occupation', label: 'Occupation', type: 'text' },
  { key: 'contactNumber', label: 'Phone number', type: 'tel' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'address', label: 'Address', type: 'textarea' },
])

const handleFieldSave = async (field, value) => {
  localMember.value[field] = value

  if (field === 'dateOfBirth' && value) {
    localMember.value.age = calculateAgeFromDate(value)
  }

  try {
    const { id, firestoreId, ...dataToUpdate } = localMember.value

    Object.keys(dataToUpdate).forEach((key) => {
      if (dataToUpdate[key] === undefined || dataToUpdate[key] === '') {
        if (!['tags', 'ministries', 'isMember', 'image'].includes(key)) {
          delete dataToUpdate[key]
        }
      }
    })

    await updateMemberInFirestore(member.value, dataToUpdate)
  } catch (error) {
    console.error('Error updating member:', error)
    toast.error('Could not save that change. Please try again.')
  }
}

/* -------------------------------------------------------------- deleting */
const showConfirmation = ref(false)
const confirmationConfig = ref({
  title: 'Confirm Action',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  confirmButtonClass: 'bg-[#01779b] text-white hover:bg-[#015a77]',
  onConfirm: null,
})

const showConfirmModal = (config) => {
  confirmationConfig.value = { ...confirmationConfig.value, ...config }
  showConfirmation.value = true
}

const handleConfirmation = () => {
  if (confirmationConfig.value.onConfirm) confirmationConfig.value.onConfirm()
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
        toast.error('Could not delete that person. Please try again.')
      }
    },
  })
}

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
</script>

<template>
  <!-- A focus route gets the raw box, so the padding and the safe areas are
       this page's own - there is no layout chrome left to provide them. -->
  <div class="flex h-full flex-col bg-gray-50 dark:bg-gray-900">
    <!-- Sticky, because a profile is longer than a phone screen and the way
         back should not be something you scroll up to find. -->
    <header
      class="sticky top-0 z-30 flex shrink-0 items-center gap-2 border-b border-gray-200 bg-white/90 px-2 py-2 backdrop-blur pt-[calc(0.5rem+env(safe-area-inset-top))] dark:border-gray-700 dark:bg-gray-800/90"
    >
      <button
        @click="router.push('/members')"
        class="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        <ArrowLeft class="h-5 w-5 shrink-0" />
        <span class="hidden sm:inline">People</span>
      </button>

      <p
        :class="[
          'min-w-0 flex-1 truncate px-1 text-sm font-semibold text-gray-900 transition-opacity dark:text-white',
          scrolled ? 'opacity-100' : 'opacity-0',
        ]"
        aria-hidden="true"
      >
        {{ member ? getFullName(localMember) : '' }}
      </p>

      <button
        v-if="member && canEdit"
        @click="isEditMode = !isEditMode"
        :aria-label="isEditMode ? 'Done editing' : 'Edit this profile'"
        :title="isEditMode ? 'Done' : 'Edit'"
        :class="[
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
          isEditMode
            ? 'bg-primary text-white hover:bg-primary-hover'
            : 'border border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700',
        ]"
      >
        <Check v-if="isEditMode" class="h-4.5 w-4.5" />
        <Edit2 v-else class="h-4.5 w-4.5" />
      </button>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-1 items-center justify-center">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
    </div>

    <!-- Not Found -->
    <div
      v-else-if="!member"
      class="flex flex-1 flex-col items-center justify-center px-6 text-gray-500 dark:text-gray-400"
    >
      <Users class="mb-4 h-16 w-16 opacity-50" />
      <p class="text-lg">Member not found</p>
      <button
        @click="router.push('/members')"
        class="mt-4 rounded-lg bg-primary px-4 py-2 text-white transition-colors hover:bg-primary-hover"
      >
        Back to People
      </button>
    </div>

    <div
      v-else
      @scroll.passive="onScroll"
      class="flex-1 overflow-y-auto pb-[calc(2rem+env(safe-area-inset-bottom))]"
    >
      <div class="mx-auto w-full max-w-2xl space-y-3 pb-3 sm:px-4 sm:pt-3">
        <!-- ============ Identity ============ -->
        <!-- No cover strip. A cover is a photograph somebody chose, and nobody
             here is going to choose one — an empty gradient band was a tenth of
             a phone screen spent saying nothing. The space under the name goes
             to the three things you actually come here asking. -->
        <section
          class="border-b border-gray-200 bg-white px-4 py-4 sm:rounded-2xl sm:border dark:border-gray-700 dark:bg-gray-800"
        >
          <div class="flex items-start gap-4">
            <div class="relative shrink-0">
              <MemberAvatar
                :member="localMember"
                size="h-20 w-20"
                plain-class="border-2 border-white dark:border-gray-700 shadow-md"
              />
              <!-- Always drawn, not revealed on hover: there is no hover on a
                   phone, and this was the only way to change a photo. -->
              <button
                v-if="canEdit"
                @click="showImageCropper = true"
                aria-label="Change photo"
                class="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white bg-primary p-1.5 text-white shadow-md transition-colors hover:bg-primary-hover dark:border-gray-800"
              >
                <Camera class="h-3.5 w-3.5" />
              </button>
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex items-start gap-2">
                <h1 class="min-w-0 flex-1 text-xl font-bold text-gray-900 sm:text-2xl dark:text-white">
                  {{ getFullName(localMember) }}
                </h1>
                <!-- Only when the record says so. The helper answers "female"
                     for a blank, which would put a sign on every record nobody
                     has filled in yet. -->
                <span
                  v-if="sexMark"
                  :class="['shrink-0 text-2xl leading-none', sexMark.color]"
                  :title="sexMark.label"
                >
                  {{ sexMark.glyph }}
                  <span class="sr-only">{{ sexMark.label }}</span>
                </span>
              </div>
              <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                <template v-for="(part, i) in introParts" :key="i">
                  <span v-if="i" class="px-1 text-gray-300 dark:text-gray-600">·</span>{{ part }}
                </template>
              </p>
              <YouBadge :member="localMember" class="mt-1.5" />
            </div>
          </div>

          <!-- Three facts worth the space a cover photo was taking. -->
          <div
            v-if="headlineStats.length"
            class="mt-4 grid gap-2"
            :style="{ gridTemplateColumns: `repeat(${headlineStats.length}, minmax(0, 1fr))` }"
          >
            <div
              v-for="stat in headlineStats"
              :key="stat.key"
              class="rounded-xl bg-gray-50 px-2 py-2 text-center dark:bg-gray-700/40"
            >
              <p class="truncate text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                {{ stat.value }}
              </p>
              <p class="truncate text-[11px] text-gray-500 dark:text-gray-400">{{ stat.label }}</p>
            </div>
          </div>

          <div
            v-if="contactActions.length"
            class="mt-3 grid gap-2"
            :style="{ gridTemplateColumns: `repeat(${contactActions.length}, minmax(0, 1fr))` }"
          >
            <a
              v-for="action in contactActions"
              :key="action.key"
              :href="action.href"
              class="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              <component :is="action.icon" class="h-4 w-4 shrink-0" />
              {{ action.label }}
            </a>
          </div>
        </section>

        <div class="space-y-3 px-3 sm:px-0">
          <!-- ============ Gaps ============ -->
          <div
            v-if="gaps.length"
            class="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-500/10"
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

          <!-- ============ Attendance ============ -->
          <!-- Only the gatherings this person was expected at: a choir practice
               is on a chorister's profile and nobody else's, a Sunday service
               is on everyone's. -->
          <section
            v-if="history.length"
            class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
          >
            <div class="mb-3 flex items-baseline justify-between gap-2">
              <h2 class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Attendance
              </h2>
              <p v-if="counted.length" class="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                <span class="font-bold text-gray-900 dark:text-white">{{ presentCount }}</span>
                of {{ counted.length }} recorded
              </p>
            </div>

            <!-- Each gathering says which one it was. The squares alone
                 needed a tooltip to be read, and a phone has no hover. -->
            <div class="space-y-3">
              <div v-for="month in byMonth" :key="month.key">
                <p
                  class="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500"
                >
                  {{ month.label }}
                </p>
                <ul class="space-y-1">
                  <li
                    v-for="item in month.items"
                    :key="item.key"
                    class="flex items-center gap-2.5"
                  >
                    <span
                      :class="['h-4 w-4 shrink-0 rounded', ATTENDANCE_STYLE[item.state]]"
                      role="img"
                      :aria-label="stateWord[item.state]"
                    ></span>
                    <span class="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-white">
                      {{ item.title }}
                    </span>
                    <span
                      class="shrink-0 text-xs tabular-nums text-gray-400 dark:text-gray-500"
                    >
                      {{ dayOf(item.date) }}
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <!-- Green and red speak for themselves; the hollow one does not,
                 and it is the one that matters. A head count says how many
                 came, never who, so those are shown but never counted. -->
            <p
              v-if="unrecordedCount"
              class="mt-3 flex items-start gap-2 text-[11px] text-gray-400 dark:text-gray-500"
            >
              <span
                class="mt-0.5 h-3 w-3 shrink-0 rounded border border-dashed border-gray-300 dark:border-gray-600"
              ></span>
              <span>
                {{ unrecordedCount === 1 ? 'One was' : `${unrecordedCount} were` }} counted as a
                head count only, so nobody's name was written down.
              </span>
            </p>
          </section>

          <!-- ============ About ============ -->
          <section class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              About
            </h2>

            <!-- Reading -->
            <div v-if="!isEditMode" class="space-y-2.5">
              <div v-for="fact in about" :key="fact.key" class="flex items-start gap-3">
                <component
                  :is="fact.icon"
                  :class="[
                    'mt-0.5 h-4 w-4 shrink-0',
                    fact.iconClass || 'text-gray-400 dark:text-gray-500',
                  ]"
                />
                <p
                  :class="[
                    'min-w-0 flex-1 whitespace-pre-line break-words text-sm',
                    fact.text ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500',
                  ]"
                >
                  {{ fact.text || fact.missing }}
                </p>
              </div>
            </div>

            <!-- Editing -->
            <div v-else class="space-y-4">
              <InlineEditField
                v-for="field in editFields"
                :key="field.key"
                :forceEdit="true"
                :modelValue="localMember[field.key]"
                :label="field.label"
                :type="field.type"
                :options="field.options"
                @update:modelValue="localMember[field.key] = $event"
                @save="handleFieldSave(field.key, $event)"
              />
            </div>
          </section>

          <!-- ============ Church ============ -->
          <section class="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h2 class="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              <Church class="h-3.5 w-3.5" />
              Church
            </h2>

            <div class="space-y-4">
              <!-- Standing. Read mode says it in the intro line already, so it
                   only appears here as a control. -->
              <div v-if="isEditMode">
                <p class="mb-1.5 text-xs text-gray-400 dark:text-gray-500">Standing</p>
                <div class="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-600">
                  <button
                    v-for="opt in [
                      { on: true, label: 'Member' },
                      { on: false, label: 'Attendee' },
                    ]"
                    :key="opt.label"
                    @click="handleFieldSave('isMember', opt.on)"
                    :aria-pressed="!!localMember.isMember === opt.on"
                    :class="[
                      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      !!localMember.isMember === opt.on
                        ? 'bg-primary text-white'
                        : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700',
                    ]"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>

              <!-- Ministries come from the controlled list in Settings because
                   they grant access; tags are free text and grant nothing. -->
              <div>
                <p class="mb-1.5 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                  <Users class="h-3.5 w-3.5" />
                  Ministries
                </p>
                <InlineEditField
                  v-if="isEditMode"
                  :forceEdit="true"
                  :modelValue="localMember.ministries"
                  label="Ministries"
                  type="tags"
                  :allTags="ministryNames"
                  emptyText="Not serving in any ministry"
                  @update:modelValue="localMember.ministries = $event"
                  @save="handleFieldSave('ministries', $event)"
                />
                <div v-else-if="(localMember.ministries || []).length" class="flex flex-wrap gap-1.5">
                  <span
                    v-for="name in localMember.ministries"
                    :key="name"
                    class="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary dark:bg-primary-light/20 dark:text-primary-light"
                  >
                    {{ name }}
                  </span>
                </div>
                <p v-else class="text-sm text-gray-400 dark:text-gray-500">
                  Not serving in any ministry
                </p>
              </div>

              <div>
                <p class="mb-1.5 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                  <Tag class="h-3.5 w-3.5" />
                  Tags
                </p>
                <InlineEditField
                  v-if="isEditMode"
                  :forceEdit="true"
                  :modelValue="localMember.tags"
                  label="Tags"
                  type="tags"
                  :allTags="allTags"
                  emptyText="No tags"
                  @update:modelValue="localMember.tags = $event"
                  @save="handleFieldSave('tags', $event)"
                />
                <div v-else-if="(localMember.tags || []).length" class="flex flex-wrap gap-1.5">
                  <span
                    v-for="tag in localMember.tags"
                    :key="tag"
                    class="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  >
                    {{ tag }}
                  </span>
                </div>
                <p v-else class="text-sm text-gray-400 dark:text-gray-500">No tags</p>
              </div>
            </div>
          </section>

          <!-- Destructive last, and only while editing. -->
          <div v-if="isEditMode && canEdit">
            <button
              @click="handleDelete"
              class="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <Trash2 class="h-4 w-4" />
              Delete this person
            </button>
            <p class="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
              Changes save as you make them.
            </p>
          </div>
        </div>
      </div>
    </div>

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
