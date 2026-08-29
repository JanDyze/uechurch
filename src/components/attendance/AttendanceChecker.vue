<script setup>
import { computed, ref } from 'vue'
import { X, Search, Check, Trash2 } from '../../icons'
import { useMembers } from '../../composables/useMembers'
import { useMediaQuery } from '../../composables/useMediaQuery'
import { useAppSettings } from '../../composables/useAppSettings'

const isMobile = useMediaQuery('(max-width: 1023px)')

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  isEdit: {
    type: Boolean,
    default: false
  },
  attendanceData: {
    type: Object,
    required: true
  },
  eventData: {
    type: Object,
    default: null
  },
  // Attendance recorded against an event: the event owns the title and date,
  // so show them read-only instead of letting the two drift apart.
  detailsLocked: {
    type: Boolean,
    default: false
  },
  // 'event' | 'minute' when this drawer was opened from a generated
  // "Not recorded" row, which can only be removed by deleting its source.
  placeholderKind: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['update:show', 'update:attendanceData', 'save', 'cancel', 'delete', 'delete-source'])

const { members } = useMembers()
const searchQuery = ref('')

// Check if creating new (no event data and not editing)
const isNewAttendance = computed(() => !props.eventData && !props.isEdit)

// Initialize form data
const formData = computed({
  get: () => {
    if (props.eventData && !props.isEdit) {
      return {
        eventId: props.eventData.firestoreId || props.eventData.id || '',
        eventType: props.eventData.eventType || props.eventData.type || '',
        eventTitle: props.eventData.eventTitle || props.eventData.title || '',
        date: props.eventData.date || '',
        time: props.eventData.time || '',
        location: props.eventData.location || '',
        attendees: props.attendanceData.attendees || [],
        notes: props.attendanceData.notes || '',
        expectedAttendees: props.eventData.expectedAttendees || props.eventData.attendees || 0
      }
    }
    return props.attendanceData
  },
  set: (value) => {
    emit('update:attendanceData', value)
  }
})

// Update form field
const updateField = (field, value) => {
  emit('update:attendanceData', { ...formData.value, [field]: value })
}

const isFormValid = computed(() => {
  return formData.value.eventTitle && formData.value.eventTitle.trim().length > 0 &&
         formData.value.date && formData.value.date.length > 0
})

// Filter members by search
const filteredMembers = computed(() => {
  let filtered = members.value || []
  
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(member => {
      const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim().toLowerCase()
      return fullName.includes(query)
    })
  }
  
  return filtered
})

// Toggle member attendance
const toggleAttendee = (memberId) => {
  const attendees = [...(formData.value.attendees || [])]
  const index = attendees.findIndex(id => String(id) === String(memberId) || id === memberId)
  if (index > -1) {
    attendees.splice(index, 1)
  } else {
    attendees.push(memberId)
  }
  emit('update:attendanceData', { ...formData.value, attendees })
}

// Check if member is present
const isPresent = (memberId) => {
  return (formData.value.attendees || []).some(id => String(id) === String(memberId) || id === memberId)
}

// Bulk actions operate on the members currently shown, so searching for a
// family name and tapping "Mark shown" marks just that group.
const markAllShown = () => {
  const attendees = [...(formData.value.attendees || [])]
  filteredMembers.value.forEach(member => {
    const id = member.id || member.firestoreId
    if (!attendees.some(a => String(a) === String(id))) {
      attendees.push(id)
    }
  })
  emit('update:attendanceData', { ...formData.value, attendees })
}

const clearAllShown = () => {
  const shownIds = new Set(
    filteredMembers.value.map(member => String(member.id || member.firestoreId))
  )
  const attendees = (formData.value.attendees || []).filter(
    a => !shownIds.has(String(a))
  )
  emit('update:attendanceData', { ...formData.value, attendees })
}

const isSearching = computed(() => searchQuery.value.trim().length > 0)

const handleSave = () => {
  if (isFormValid.value) {
    emit('save')
  }
}

const handleCancel = () => {
  emit('cancel')
}

const presentCount = computed(() => formData.value.attendees?.length || 0)
const totalCount = computed(() => members.value?.length || 0)

// Was a third, divergent hardcoded list; now the same vocabulary as Events.
const { categories: appCategories } = useAppSettings()
const eventTypes = computed(() => appCategories.value.eventTypes)
</script>

<template>
  <Teleport to="body" :disabled="!isMobile">
    <Transition :name="isMobile ? 'modal-sheet' : 'drawer'">
    <div
      v-if="show"
      :class="[
        isMobile
          ? 'fixed inset-0 z-80 flex flex-col justify-end'
          : 'bg-white dark:bg-gray-800 w-1/2 h-full flex flex-col shrink-0 border-l border-gray-200 dark:border-gray-700'
      ]"
    >
      <div
        v-if="isMobile"
        class="absolute inset-0 bg-black/50"
        @click="handleCancel"
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
      <div class="shrink-0 rounded-t-2xl px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-gray-900 dark:text-white">
            {{ isNewAttendance ? 'New Attendance' : (isEdit ? 'Edit Attendance' : formData.eventTitle || 'Record Attendance') }}
          </h3>
          <button
            @click="handleCancel"
            class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X class="h-5 w-5" />
          </button>
        </div>
      </div>

      <!-- Event Details Form (only for new attendance) -->
      <div v-if="(isNewAttendance || isEdit) && !detailsLocked" class="shrink-0 px-5 py-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Title *</label>
          <input
            :value="formData.eventTitle"
            @input="updateField('eventTitle', $event.target.value)"
            type="text"
            placeholder="e.g. Sunday Worship Service"
            class="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Date *</label>
            <input
              :value="formData.date"
              @input="updateField('date', $event.target.value)"
              type="date"
              class="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
            <select
              :value="formData.eventType"
              @change="updateField('eventType', $event.target.value)"
              class="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="">Select type</option>
              <option v-for="type in eventTypes" :key="type" :value="type" class="capitalize">
                {{ type.charAt(0).toUpperCase() + type.slice(1) }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <!-- Event Info (when recording for existing event) -->
      <div v-else class="shrink-0 px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <p class="text-sm font-medium text-gray-900 dark:text-white">{{ formData.eventTitle }}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {{ formData.date }}
          <span v-if="formData.eventType" class="ml-2 px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700">{{ formData.eventType }}</span>
        </p>
        <p v-if="detailsLocked" class="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
          Title and date come from the {{ formData.eventType === 'meeting' ? 'meeting' : 'event' }}. Edit them there.
        </p>
      </div>

      <!-- Search -->
      <div class="shrink-0 px-5 py-3 border-b border-gray-100 dark:border-gray-700">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search members..."
            class="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-1 focus:ring-primary text-gray-900 dark:text-white"
          />
        </div>
      </div>

      <!-- Bulk actions -->
      <div class="shrink-0 px-5 py-2 flex items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-700">
        <span class="text-xs text-gray-500 dark:text-gray-400">
          {{ filteredMembers.length }} {{ filteredMembers.length === 1 ? 'member' : 'members' }} shown
        </span>
        <div class="flex items-center gap-1.5">
          <button
            @click="markAllShown"
            class="px-2.5 py-1.5 text-xs font-medium rounded-lg text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
          >
            {{ isSearching ? 'Mark shown' : 'Mark all' }}
          </button>
          <button
            @click="clearAllShown"
            class="px-2.5 py-1.5 text-xs font-medium rounded-lg text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      <!-- Members List -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="filteredMembers.length === 0" class="p-8 text-center text-gray-400 text-sm">
          No members found
        </div>
        <div v-else class="divide-y divide-gray-100 dark:divide-gray-700">
          <button
            v-for="member in filteredMembers"
            :key="member.id || member.firestoreId"
            @click="toggleAttendee(member.id || member.firestoreId)"
            class="w-full px-5 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
          >
            <div :class="[
              'w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors',
              isPresent(member.id || member.firestoreId)
                ? 'bg-green-500'
                : 'border-2 border-gray-300 dark:border-gray-600'
            ]">
              <Check v-if="isPresent(member.id || member.firestoreId)" class="h-3 w-3 text-white" />
            </div>
            <span class="text-sm text-gray-900 dark:text-white truncate">
              {{ `${member.firstName || ''} ${member.lastName || ''}`.trim() }}
            </span>
          </button>
        </div>
      </div>

      <!-- Footer -->
      <div class="shrink-0 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-3">
          <!-- Deletes the saved attendance record only -->
          <button
            v-if="isEdit"
            @click="emit('delete')"
            class="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            title="Delete this attendance record"
            aria-label="Delete this attendance record"
          >
            <Trash2 class="h-5 w-5" />
          </button>
          <span class="flex-1 text-sm text-gray-500 dark:text-gray-400">
            <span class="font-semibold text-gray-900 dark:text-white">{{ presentCount }}</span> / {{ totalCount }} present
            <span v-if="!isEdit" class="block text-xs text-gray-400 dark:text-gray-500">
              Not saved yet
            </span>
          </span>
          <button
            @click="handleSave"
            :disabled="!isFormValid"
            :class="[
              'px-5 py-2 text-sm font-medium rounded-lg transition-colors',
              isFormValid
                ? 'bg-primary dark:bg-primary-light text-white hover:bg-primary-hover dark:hover:bg-[#1ca3b8]'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
            ]"
          >
            Save Attendance
          </button>
        </div>

        <!-- Nothing is saved for this row yet, so the only thing to remove is
             the event/meeting that generates it. Spelled out on its own line so
             it cannot be mistaken for deleting attendance. -->
        <button
          v-if="!isEdit && placeholderKind"
          @click="emit('delete-source')"
          class="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
        >
          <Trash2 class="h-4 w-4" />
          Delete this {{ placeholderKind === 'minute' ? 'meeting' : 'event' }}
        </button>
      </div>
      </div>
    </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: max-width 0.3s ease-out, opacity 0.3s ease;
}

.drawer-enter-from,
.drawer-leave-to {
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

