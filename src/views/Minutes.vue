<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMinutes } from '../composables/useMinutes'
import { useMembers } from '../composables/useMembers'
import MinutesToolbar from '../components/minutes/MinutesToolbar.vue'
import MinuteListItem from '../components/minutes/MinuteListItem.vue'
import MinuteEditorDrawer from '../components/minutes/MinuteEditorDrawer.vue'
import MinuteDetailsDrawer from '../components/minutes/MinuteDetailsDrawer.vue'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'

const router = useRouter()
const { minutes, loading, addMinuteToFirestore, updateMinuteInFirestore, removeMinute } = useMinutes()

const searchQuery = ref('')
const showAddMinute = ref(false)
const showMinuteDetails = ref(false)
const showEditMinute = ref(false)
const selectedMinute = ref(null)
const editingMinute = ref(null)

const newMinuteData = ref({
  title: '',
  date: '',
  startTime: '',
  endTime: '',
  location: '',
  attendees: [],
  agenda: []
})

// Confirmation modal state
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

const filteredMinutes = computed(() => {
  if (!searchQuery.value.trim()) return minutes.value
  
  const query = searchQuery.value.toLowerCase()
  return minutes.value.filter(minute => 
    minute.title.toLowerCase().includes(query) ||
    minute.location?.toLowerCase().includes(query) ||
    minute.content?.toLowerCase().includes(query)
  )
})

// Group minutes by month
const minutesByMonth = computed(() => {
  const grouped = {}
  
  filteredMinutes.value.forEach(minute => {
    if (!minute.date) return
    
    const date = new Date(minute.date)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    
    if (!grouped[monthKey]) {
      grouped[monthKey] = {
        label: monthLabel,
        minutes: []
      }
    }
    
    grouped[monthKey].minutes.push(minute)
  })
  
  // Sort months descending (newest first)
  return Object.entries(grouped)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, value]) => ({ key, ...value }))
})

const selectedMinuteId = computed(() => {
  return selectedMinute.value?.id || selectedMinute.value?.firestoreId || null
})

const handleNewMinute = () => {
  if (showAddMinute.value) {
    // If already open, close it
    showAddMinute.value = false
  } else {
    // If closed, open it and reset data
    newMinuteData.value = {
      title: '',
      date: '',
      startTime: '',
      endTime: '',
      location: '',
      attendees: [],
      agenda: []
    }
    showEditMinute.value = false
    showMinuteDetails.value = false
    showAddMinute.value = true
  }
}

const handleMinuteClick = (minute) => {
  selectedMinute.value = minute
  showAddMinute.value = false
  showEditMinute.value = false
  showMinuteDetails.value = true
}

const handleEditMinute = () => {
  if (!selectedMinute.value) return
  editingMinute.value = { ...selectedMinute.value }
  const { firestoreId, id, createdAt, updatedAt, structure, ...minuteData } = selectedMinute.value
  // Extract agenda from structure if it exists
  newMinuteData.value = {
    ...minuteData,
    agenda: structure?.agenda || []
  }
  showMinuteDetails.value = false
  showAddMinute.value = false
  showEditMinute.value = true
}

const handleSaveMinute = async () => {
  try {
    if (showEditMinute.value && editingMinute.value) {
      // When editing, move agenda to structure
      const { agenda, ...minuteDataWithoutAgenda } = newMinuteData.value
      const currentStructure = editingMinute.value.structure || {
        agenda: [],
        discussions: {},
        decisions: {},
        actionItems: []
      }
      const updatedStructure = {
        ...currentStructure,
        agenda: agenda || []
      }
      await updateMinuteInFirestore(editingMinute.value, {
        ...minuteDataWithoutAgenda,
        structure: updatedStructure
      })
      showAddMinute.value = false
      showEditMinute.value = false
      editingMinute.value = null
      newMinuteData.value = {
        title: '',
        date: '',
        startTime: '',
        endTime: '',
        location: '',
        attendees: [],
        agenda: []
      }
    } else {
      // Create new minute and redirect to editor
      const { agenda, ...minuteDataWithoutAgenda } = newMinuteData.value
      const structure = {
        agenda: agenda || [],
        discussions: {},
        decisions: {},
        actionItems: []
      }
      const minuteId = await addMinuteToFirestore({
        ...minuteDataWithoutAgenda,
        structure
      })
      showAddMinute.value = false
      // Redirect to details page with the new minute ID
      router.push(`/minutes/${minuteId}`)
    }
  } catch (error) {
    console.error('Error saving minute:', error)
    showConfirmModal({
      title: 'Error',
      message: 'Failed to save minutes. Please try again.',
      confirmText: 'OK',
      cancelText: '',
      onConfirm: () => {},
    })
  }
}

const handleDeleteMinute = () => {
  if (!selectedMinute.value) return
  
  showConfirmModal({
    title: 'Delete Minutes',
    message: `Are you sure you want to delete "${selectedMinute.value.title}"? This action cannot be undone.`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    confirmButtonClass: 'bg-red-600 text-white hover:bg-red-700',
    onConfirm: async () => {
      try {
        await removeMinute(selectedMinute.value)
        showMinuteDetails.value = false
        selectedMinute.value = null
      } catch (error) {
        console.error('Error deleting minute:', error)
        showConfirmModal({
          title: 'Error',
          message: 'Failed to delete minutes. Please try again.',
          confirmText: 'OK',
          cancelText: '',
          onConfirm: () => {},
        })
      }
    }
  })
}

const handleCancelMinute = () => {
  showAddMinute.value = false
  showEditMinute.value = false
  editingMinute.value = null
  newMinuteData.value = {
    title: '',
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    attendees: [],
    agenda: []
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Toolbar -->
    <MinutesToolbar
      :search-query="searchQuery"
      :show-add-minute="showAddMinute"
      @update:search-query="searchQuery = $event"
      @new-minute="handleNewMinute"
    />

    <!-- Main Content -->
    <div class="flex-1 overflow-hidden flex relative">
      <!-- Minutes List -->
      <div class="flex-1 overflow-y-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div v-if="loading" class="divide-y divide-gray-200 dark:divide-gray-700">
          <div
            v-for="i in 10"
            :key="`skeleton-${i}`"
            class="p-4 flex items-center gap-4"
          >
            <div class="h-12 w-12 rounded-lg bg-gray-200 dark:bg-gray-600 animate-pulse"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 w-32 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
              <div class="h-3 w-24 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
        <div v-else-if="filteredMinutes.length === 0" class="p-8 text-center text-gray-500 dark:text-gray-400">
          <div class="text-gray-400 dark:text-gray-500 mb-4">
            <svg class="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p class="mb-4">
            {{ searchQuery ? 'No minutes found matching your search.' : 'No meeting minutes yet.' }}
          </p>
          <button
            v-if="!searchQuery"
            @click="handleNewMinute"
            class="px-4 py-2 bg-[#01779b] text-white rounded-lg hover:bg-[#015a77] transition-colors"
          >
            Create First Minutes
          </button>
        </div>
        <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
          <template v-for="monthGroup in minutesByMonth" :key="monthGroup.key">
            <!-- Month Header -->
            <div class="sticky top-0 z-10 bg-gray-100 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-600">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                {{ monthGroup.label }}
              </h3>
            </div>
            <!-- Minutes for this month -->
            <MinuteListItem
              v-for="minute in monthGroup.minutes"
              :key="minute.id || minute.firestoreId"
              :minute="minute"
              :selected="selectedMinuteId === (minute.id || minute.firestoreId)"
              @click="handleMinuteClick(minute)"
            />
          </template>
        </div>
      </div>

      <!-- Add/Edit Minute Drawer -->
      <MinuteEditorDrawer
        :show="showAddMinute || showEditMinute"
        :is-edit="showEditMinute"
        :minute-data="newMinuteData"
        @update:show="handleCancelMinute"
        @update:minute-data="newMinuteData = $event"
        @save="handleSaveMinute"
        @cancel="handleCancelMinute"
      />

      <!-- Minute Details Drawer -->
      <MinuteDetailsDrawer
        :show="showMinuteDetails"
        :minute="selectedMinute"
        @update:show="showMinuteDetails = $event"
        @edit="handleEditMinute"
        @delete="handleDeleteMinute"
        @export="() => {}"
      />
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
  </div>
</template>

