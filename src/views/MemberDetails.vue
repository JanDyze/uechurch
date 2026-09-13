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
import LabelMark from '../components/common/LabelMark.vue'
import { useLabelMarks } from '../composables/useLabelMarks'
import { getIconForEvent } from '../utils/eventIcons'
import { uploadImage } from '../api/blobService'
import { useToast } from '../composables/useToast'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { members, loading, updateMemberInFirestore, removeMember } = useMembers()
const { ministryNames } = useMinistries()
const { ministryMark, tagMark } = useLabelMarks()

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
// Wider than the composable's default: a gathering is a square the size of a
// letter now rather than a line per Sunday, so a few months of history fit in
// less room than a fortnight used to take.
const { history, counted, presentCount, unrecordedCount } =
  useMemberAttendance(localMember, { limit: 60 })

const ATTENDANCE_STYLE = {
  present: 'bg-green-500 dark:bg-green-500',
  absent: 'bg-red-500 dark:bg-red-500',
  unrecorded:
    'bg-transparent border border-dashed border-gray-300 dark:border-gray-600',
}

const stateWord = { present: 'Came', absent: 'Did not come', unrecorded: 'Not recorded' }

/**
 * A gathering to a row, a month to a column: Sunday Service, then its Sundays
 * as small squares under AUG and SEP. Read across, a row is one person's habit
 * with one gathering — which is the question a profile is opened to answer —
 * and the months line up down the page, so "stopped coming to the prayer
 * meeting in August" is a gap you see rather than a date you look for.
 *
 * Oldest month on the left and oldest day first inside it, the way a week
 * reads. Dates are not printed; a tap on a square says it.
 */
const attendanceGrid = computed(() => {
  const thisYear = new Date().getFullYear()
  const months = new Map()
  const rows = new Map()

  history.value.forEach((item) => {
    const iso = String(item.date || '')
    const key = iso.slice(0, 7)
    if (!key) return
    if (!months.has(key)) {
      const [y, mo] = key.split('-').map(Number)
      const d = new Date(y, mo - 1, 1)
      months.set(key, {
        key,
        label:
          d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase() +
          (y === thisYear ? '' : ` '${String(y).slice(2)}`),
      })
    }
    // By series, not by title: the Sunday with an occasion on it is still a
    // square on the Sunday service's row (useMemberAttendance.js).
    if (!rows.has(item.seriesKey)) {
      rows.set(item.seriesKey, {
        key: item.seriesKey,
        title: item.seriesTitle,
        icon: getIconForEvent({ icon: item.icon, type: item.type }),
        byMonth: {},
        latest: iso,
      })
    }
    const row = rows.get(item.seriesKey)
    ;(row.byMonth[key] ||= []).push(item)
    if (iso > row.latest) row.latest = iso
  })

  const columns = [...months.values()].sort((x, y) => x.key.localeCompare(y.key))
  columns.forEach(({ key }) =>
    rows.forEach((row) => row.byMonth[key]?.sort((x, y) => String(x.date).localeCompare(String(y.date))))
  )

  return {
    columns,
    // The gathering seen most recently first: the one still going on is the
    // one the reader most likely came about.
    rows: [...rows.values()].sort((x, y) => y.latest.localeCompare(x.latest) || x.title.localeCompare(y.title)),
  }
})

// The date is one tap away rather than printed on every square. Tapping the
// same square again puts it away.
const pickedDay = ref(null)
const pickDay = (item) => {
  pickedDay.value = pickedDay.value?.key === item.key ? null : item
}

const longDay = (iso) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
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
 * The next birthday, said the way you would say it — and only while it is
 * close. "In 5 days" is worth reading; "12 Mar" is the date already printed
 * beside it.
 */
const birthdaySoon = computed(() => {
  const iso = localMember.value?.dateOfBirth
  if (!iso) return ''
  const dob = new Date(iso)
  if (Number.isNaN(dob.getTime())) return ''

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate())
  if (next < today) next.setFullYear(next.getFullYear() + 1)

  const days = Math.round((next - today) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days <= 30) return `in ${days} days`
  return ''
})

/** Of the gatherings a register was kept for, how many they came to. */
const attendanceRate = computed(() => {
  if (!counted.value.length) return null
  return Math.round((presentCount.value / counted.value.length) * 100)
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
 * line above, and this is the same page. So is sex — the sign beside the name
 * already says it, in the same colour — which leaves civil status its own
 * line. A birthday is said once, here, with the countdown on the end when it
 * is near: it used to be a tile under the name as well.
 */
const about = computed(() => {
  const m = localMember.value || {}
  return [
    {
      key: 'dateOfBirth',
      icon: Gift,
      text: [fmtDate(m.dateOfBirth), birthdaySoon.value && `Birthday ${birthdaySoon.value}`]
        .filter(Boolean)
        .join(' · '),
      missing: 'Birthday not set',
    },
    {
      key: 'civilStatus',
      icon: User,
      // Only when there is no sign beside the name is sex worth a word here.
      text: [sexMark.value ? '' : m.sex, m.civilStatus].filter(Boolean).join(' · '),
      missing: sexMark.value ? 'Civil status not set' : 'Sex not set',
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
             a phone screen spent saying nothing. Nor tiles of figures under the
             name: each one repeated a section further down the same page. -->
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
                of {{ counted.length }}
                <span class="text-gray-400 dark:text-gray-500">· {{ attendanceRate }}%</span>
              </p>
            </div>

            <!-- One grid for the whole table, so every row's months sit under
                 the same heading however many squares each holds. Scrolls
                 sideways on its own when a long history outgrows the phone. -->
            <div class="-mx-4 overflow-x-auto px-4">
              <div
                class="grid w-max min-w-full items-center gap-x-4"
                :style="{ gridTemplateColumns: `repeat(${attendanceGrid.columns.length}, max-content)` }"
              >
                <span
                  v-for="month in attendanceGrid.columns"
                  :key="month.key"
                  class="pb-1 text-[10px] font-bold tracking-wider text-gray-400 dark:text-gray-500"
                >
                  {{ month.label }}
                </span>

                <template v-for="row in attendanceGrid.rows" :key="row.key">
                  <p
                    class="col-span-full mt-2 flex min-w-0 items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300"
                  >
                    <component :is="row.icon" class="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500" />
                    <span class="truncate">{{ row.title }}</span>
                  </p>
                  <div
                    v-for="month in attendanceGrid.columns"
                    :key="`${row.key}-${month.key}`"
                    class="flex h-4 items-center"
                  >
                    <!-- The square is small; the button around it is not, so a
                         thumb can still land on one. -->
                    <button
                      v-for="item in row.byMonth[month.key] || []"
                      :key="item.key"
                      type="button"
                      @click="pickDay(item)"
                      :aria-label="`${item.title}, ${longDay(item.date)}: ${stateWord[item.state]}`"
                      :aria-pressed="pickedDay?.key === item.key"
                      class="-my-1.5 p-[3px]"
                    >
                      <span
                        :class="[
                          'block h-2.5 w-2.5 rounded-[2px]',
                          ATTENDANCE_STYLE[item.state],
                          pickedDay?.key === item.key
                            ? 'ring-2 ring-primary ring-offset-1 dark:ring-primary-light dark:ring-offset-gray-800'
                            : '',
                        ]"
                      ></span>
                    </button>
                  </div>
                </template>
              </div>
            </div>

            <p v-if="pickedDay" class="mt-3 text-xs text-gray-600 dark:text-gray-300">
              <span class="font-medium">{{ pickedDay.title }}</span>
              · {{ longDay(pickedDay.date) }} · {{ stateWord[pickedDay.state] }}
            </p>

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
                    class="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary dark:bg-primary-light/20 dark:text-primary-light"
                  >
                    <LabelMark :mark="ministryMark(name)" size="h-3.5 w-3.5" />
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
                    class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  >
                    <LabelMark :mark="tagMark(tag)" size="h-3.5 w-3.5" />
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
