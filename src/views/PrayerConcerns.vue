<script setup>
import { ref, computed } from 'vue'
import { usePrayerConcerns } from '../composables/usePrayerConcerns'
import PrayerConcernsToolbar from '../components/prayerConcerns/PrayerConcernsToolbar.vue'
import PrayerConcernListItem from '../components/prayerConcerns/PrayerConcernListItem.vue'
import PrayerConcernDrawer from '../components/prayerConcerns/PrayerConcernDrawer.vue'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'

const { prayerConcerns, loading, addPrayerConcernToFirestore, updatePrayerConcernInFirestore, removePrayerConcern } = usePrayerConcerns()

const searchQuery = ref('')
const showAddConcern = ref(false)
const showEditConcern = ref(false)
const selectedConcern = ref(null)
const editingConcern = ref(null)

const newConcernData = ref({
  title: '',
  memberId: '',
  memberName: '',
  description: '',
  status: 'active',
  priority: 'normal',
  date: '',
  notes: ''
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

const filteredConcerns = computed(() => {
  if (!searchQuery.value.trim()) return prayerConcerns.value
  
  const query = searchQuery.value.toLowerCase()
  return prayerConcerns.value.filter(concern => 
    concern.title.toLowerCase().includes(query) ||
    concern.description?.toLowerCase().includes(query) ||
    concern.memberName?.toLowerCase().includes(query) ||
    concern.notes?.toLowerCase().includes(query)
  )
})

// Group concerns by month
const concernsByMonth = computed(() => {
  const grouped = {}
  
  filteredConcerns.value.forEach(concern => {
    const date = concern.date ? new Date(concern.date) : concern.createdAt
    if (!date) return
    
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    
    if (!grouped[monthKey]) {
      grouped[monthKey] = {
        label: monthLabel,
        records: []
      }
    }
    
    grouped[monthKey].records.push(concern)
  })
  
  // Sort months descending (newest first)
  return Object.entries(grouped)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, value]) => ({ key, ...value }))
})

const selectedConcernId = computed(() => {
  return selectedConcern.value?.id || selectedConcern.value?.firestoreId || null
})

const handleNewConcern = () => {
  if (showAddConcern.value) {
    showAddConcern.value = false
  } else {
    newConcernData.value = {
      title: '',
      memberId: '',
      memberName: '',
      description: '',
      status: 'active',
      priority: 'normal',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    }
    showEditConcern.value = false
    showAddConcern.value = true
  }
}

const handleConcernClick = (concern) => {
  selectedConcern.value = concern
  showAddConcern.value = false
  showEditConcern.value = true
  const { firestoreId, id, createdAt, updatedAt, ...concernData } = concern
  newConcernData.value = { ...concernData }
  editingConcern.value = concern
}

const handleSaveConcern = async () => {
  try {
    if (showEditConcern.value && editingConcern.value) {
      await updatePrayerConcernInFirestore(editingConcern.value, newConcernData.value)
    } else {
      await addPrayerConcernToFirestore(newConcernData.value)
    }
    
    showAddConcern.value = false
    showEditConcern.value = false
    editingConcern.value = null
    newConcernData.value = {
      title: '',
      memberId: '',
      memberName: '',
      description: '',
      status: 'active',
      priority: 'normal',
      date: '',
      notes: ''
    }
  } catch (error) {
    console.error('Error saving prayer concern:', error)
    showConfirmModal({
      title: 'Error',
      message: 'Failed to save prayer concern. Please try again.',
      confirmText: 'OK',
      cancelText: '',
      onConfirm: () => {},
    })
  }
}

const handleCancelConcern = () => {
  showAddConcern.value = false
  showEditConcern.value = false
  editingConcern.value = null
  newConcernData.value = {
    title: '',
    memberId: '',
    memberName: '',
    description: '',
    status: 'active',
    priority: 'normal',
    date: '',
    notes: ''
  }
}

const handleDeleteConcern = (concern) => {
  showConfirmModal({
    title: 'Delete Prayer Concern',
    message: `Are you sure you want to delete "${concern.title}"? This action cannot be undone.`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    confirmButtonClass: 'bg-red-600 text-white hover:bg-red-700',
    onConfirm: async () => {
      try {
        await removePrayerConcern(concern)
        showConfirmation.value = false
        if (selectedConcern.value?.id === concern.id || selectedConcern.value?.firestoreId === concern.firestoreId) {
          selectedConcern.value = null
          showEditConcern.value = false
        }
      } catch (error) {
        console.error('Error deleting prayer concern:', error)
        showConfirmModal({
          title: 'Error',
          message: 'Failed to delete prayer concern. Please try again.',
          confirmText: 'OK',
          cancelText: '',
          onConfirm: () => {},
        })
      }
    }
  })
}
</script>

<template>
  <div class="flex flex-col h-full">
    <PrayerConcernsToolbar
      :search-query="searchQuery"
      :show-add-concern="showAddConcern"
      @update:search-query="searchQuery = $event"
      @new-concern="handleNewConcern"
    />

    <!-- Main Content -->
    <div class="flex-1 overflow-hidden flex relative">
      <!-- Concerns List -->
      <div class="flex-1 overflow-y-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div v-if="loading" class="p-8 text-center text-gray-500 dark:text-gray-400">
          Loading prayer concerns...
        </div>
        <div v-else-if="filteredConcerns.length === 0" class="p-8 text-center text-gray-500 dark:text-gray-400">
          <p class="text-lg mb-2">No prayer concerns found</p>
          <p class="text-sm">Click the + button to add a new prayer concern</p>
        </div>
        <template v-else>
          <template v-for="monthGroup in concernsByMonth" :key="monthGroup.key">
            <div class="sticky top-0 z-10 bg-gray-100 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-600">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                {{ monthGroup.label }}
              </h3>
            </div>
            <PrayerConcernListItem
              v-for="concern in monthGroup.records"
              :key="concern.id"
              :concern="concern"
              :selected="selectedConcernId === (concern.id || concern.firestoreId)"
              @click="handleConcernClick"
              @delete="handleDeleteConcern"
            />
          </template>
        </template>
      </div>

      <!-- Add/Edit Drawer -->
      <PrayerConcernDrawer
        :show="showAddConcern || showEditConcern"
        :is-edit="showEditConcern"
        :concern-data="newConcernData"
        @update:show="(val) => { if (!val) handleCancelConcern() }"
        @update:concern-data="newConcernData = $event"
        @save="handleSaveConcern"
        @cancel="handleCancelConcern"
      />
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
  </div>
</template>

