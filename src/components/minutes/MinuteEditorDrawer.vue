<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { X, Save, Plus, Trash2, Search, ChevronDown } from 'lucide-vue-next'
import { useMembers } from '../../composables/useMembers'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  isEdit: {
    type: Boolean,
    default: false
  },
  minuteData: {
    type: Object,
    default: () => ({
      title: '',
      date: '',
      startTime: '',
      endTime: '',
      location: '',
      attendees: [],
      agenda: []
    })
  }
})

const emit = defineEmits(['update:show', 'update:minuteData', 'save', 'cancel'])

const { members } = useMembers()

const isFormValid = computed(() => {
  return props.minuteData.title && props.minuteData.title.trim().length > 0 &&
         props.minuteData.date && props.minuteData.date.length > 0
})

const filteredMembers = computed(() => {
  return members.value || []
})

const agendaItems = computed(() => {
  return Array.isArray(props.minuteData.agenda) ? props.minuteData.agenda : []
})

const toggleAttendee = (memberId) => {
  const attendees = [...(props.minuteData.attendees || [])]
  const index = attendees.indexOf(memberId)
  if (index > -1) {
    attendees.splice(index, 1)
  } else {
    attendees.push(memberId)
  }
  emit('update:minuteData', { ...props.minuteData, attendees })
}

const getMemberName = (memberId) => {
  if (!memberId) return 'Unknown'
  const member = filteredMembers.value.find(m => 
    String(m.id) === String(memberId) || 
    String(m.firestoreId) === String(memberId) ||
    m.id === memberId || 
    m.firestoreId === memberId
  )
  return member ? `${member.firstName || ''} ${member.lastName || ''}`.trim() : 'Unknown'
}

const newAgendaItem = ref('')

const addAgendaItem = () => {
  const itemText = newAgendaItem.value.trim()
  if (itemText) {
    const currentAgenda = Array.isArray(props.minuteData.agenda) ? props.minuteData.agenda : []
    const agenda = [...currentAgenda, itemText]
    const updatedData = { ...props.minuteData, agenda }
    emit('update:minuteData', updatedData)
    newAgendaItem.value = ''
  }
}

const removeAgendaItem = (index) => {
  const currentAgenda = Array.isArray(props.minuteData.agenda) ? props.minuteData.agenda : []
  const agenda = [...currentAgenda]
  agenda.splice(index, 1)
  emit('update:minuteData', { ...props.minuteData, agenda })
}

const updateAgendaItem = (index, value) => {
  const currentAgenda = Array.isArray(props.minuteData.agenda) ? props.minuteData.agenda : []
  const agenda = [...currentAgenda]
  agenda[index] = value
  emit('update:minuteData', { ...props.minuteData, agenda })
}

// Searchable dropdown state
const showAttendeeDropdown = ref(false)
const attendeeSearchQuery = ref('')

const availableMembers = computed(() => {
  const attendees = props.minuteData.attendees || []
  return filteredMembers.value.filter(m => 
    !attendees.includes(m.id || m.firestoreId) &&
    !attendees.includes(String(m.id)) &&
    !attendees.includes(String(m.firestoreId))
  )
})

const filteredAvailableMembers = computed(() => {
  if (!attendeeSearchQuery.value.trim()) {
    return availableMembers.value
  }
  const query = attendeeSearchQuery.value.toLowerCase()
  return availableMembers.value.filter(member => {
    const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim().toLowerCase()
    const nickname = (member.nickname || '').toLowerCase()
    return fullName.includes(query) || nickname.includes(query)
  })
})

const selectAttendee = (memberId) => {
  toggleAttendee(memberId)
  attendeeSearchQuery.value = ''
  showAttendeeDropdown.value = false
}

const toggleDropdown = () => {
  showAttendeeDropdown.value = !showAttendeeDropdown.value
  if (showAttendeeDropdown.value) {
    attendeeSearchQuery.value = ''
  }
}

const closeDropdown = () => {
  showAttendeeDropdown.value = false
  attendeeSearchQuery.value = ''
}

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  const dropdown = event.target.closest('.attendee-dropdown')
  if (!dropdown && showAttendeeDropdown.value) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

watch(
  () => props.show,
  (isOpen) => {
    if (isOpen && !props.minuteData.date) {
      const today = new Date().toISOString().split('T')[0]
      emit('update:minuteData', {
        ...props.minuteData,
        date: today
      })
    }
  }
)

</script>

<template>
  <Transition name="drawer">
    <div
      v-if="show"
      class="minute-editor-drawer border-l-4 border-[#01779b] bg-green-50/20 dark:bg-gray-800 w-1/2 h-full flex flex-col flex-shrink-0 shadow-2xl shadow-[#01779b]/20"
    >
      <!-- Header -->
      <div class="flex-shrink-0 bg-green-50/20 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ isEdit ? 'Edit Minutes' : 'New Meeting Minutes' }}
        </h3>
        <button
          @click="$emit('update:show', false)"
          class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <!-- Form Content -->
      <div class="flex-1 overflow-y-auto min-h-0 p-6">
        <div class="space-y-6">
          <!-- Title -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Meeting Title <span class="text-red-500">*</span>
            </label>
            <input
              :value="minuteData.title"
              @input="$emit('update:minuteData', { ...minuteData, title: $event.target.value })"
              type="text"
              placeholder="e.g., Board Meeting, Committee Meeting"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
            />
          </div>

          <!-- Date, Time, Location -->
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date <span class="text-red-500">*</span>
              </label>
              <input
                :value="minuteData.date"
                @input="$emit('update:minuteData', { ...minuteData, date: $event.target.value })"
                type="date"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Time
              </label>
              <input
                :value="minuteData.startTime"
                @input="$emit('update:minuteData', { ...minuteData, startTime: $event.target.value })"
                type="time"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Time
              </label>
              <input
                :value="minuteData.endTime"
                @input="$emit('update:minuteData', { ...minuteData, endTime: $event.target.value })"
                type="time"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
              />
            </div>
          </div>

          <!-- Location -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Location
            </label>
            <input
              :value="minuteData.location"
              @input="$emit('update:minuteData', { ...minuteData, location: $event.target.value })"
              type="text"
              placeholder="Meeting location"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
            />
          </div>

          <!-- Attendees -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Attendees
            </label>
            <div class="flex flex-wrap gap-2 mb-2">
              <span
                v-for="attendeeId in minuteData.attendees || []"
                :key="attendeeId"
                class="inline-flex items-center gap-1 px-3 py-1 bg-[#01779b]/10 dark:bg-[#01779b]/20 text-[#01779b] rounded-full text-sm"
              >
                {{ getMemberName(attendeeId) }}
                <button
                  @click="toggleAttendee(attendeeId)"
                  class="hover:text-[#015a77]"
                >
                  <X class="h-3 w-3" />
                </button>
              </span>
            </div>
            <!-- Searchable Dropdown -->
            <div class="relative attendee-dropdown">
              <button
                @click="toggleDropdown"
                type="button"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent flex items-center justify-between"
              >
                <span class="text-gray-500 dark:text-gray-400">Add attendee...</span>
                <ChevronDown 
                  :class="['h-4 w-4 text-gray-400 transition-transform', showAttendeeDropdown ? 'rotate-180' : '']"
                />
              </button>
              
              <!-- Dropdown Menu -->
              <Transition name="dropdown">
                <div
                  v-if="showAttendeeDropdown"
                  class="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-hidden flex flex-col"
                >
                  <!-- Search Input -->
                  <div class="p-2 border-b border-gray-200 dark:border-gray-700">
                    <div class="relative">
                      <Search class="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        v-model="attendeeSearchQuery"
                        type="text"
                        placeholder="Search members..."
                        class="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
                        @click.stop
                        autofocus
                      />
                    </div>
                  </div>
                  
                  <!-- Member List -->
                  <div class="flex-1 overflow-y-auto max-h-48">
                    <div v-if="filteredAvailableMembers.length === 0" class="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                      {{ attendeeSearchQuery ? 'No members found' : 'No available members' }}
                    </div>
                    <button
                      v-for="member in filteredAvailableMembers"
                      :key="member.id || member.firestoreId"
                      @click="selectAttendee(member.id || member.firestoreId)"
                      class="w-full px-3 py-2 text-left text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      {{ `${member.firstName || ''} ${member.lastName || ''}`.trim() }}
                      <span v-if="member.nickname" class="text-gray-500 dark:text-gray-400 text-xs ml-1">
                        ({{ member.nickname }})
                      </span>
                    </button>
                  </div>
                </div>
              </Transition>
            </div>
          </div>

          <!-- Agenda -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Agenda Items
            </label>
            <div class="space-y-2 mb-3">
              <div
                v-for="(item, index) in agendaItems"
                :key="`agenda-${index}`"
                class="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <span class="text-sm font-medium text-gray-600 dark:text-gray-400 w-6">{{ index + 1 }}.</span>
                <input
                  :value="item"
                  @input="updateAgendaItem(index, $event.target.value)"
                  type="text"
                  class="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
                  placeholder="Agenda item..."
                />
                <button
                  @click="removeAgendaItem(index)"
                  class="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  title="Remove agenda item"
                >
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>
            </div>
            <div class="flex gap-2">
              <input
                v-model="newAgendaItem"
                @keyup.enter="addAgendaItem"
                type="text"
                placeholder="Add agenda item..."
                class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
              />
              <button
                @click="addAgendaItem"
                class="p-1.5 text-[#01779b] hover:text-[#015a77] hover:bg-[#01779b]/10 dark:hover:bg-[#01779b]/20 rounded transition-colors"
                title="Add agenda item"
              >
                <Plus class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex-shrink-0 bg-green-50/20 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
        <div class="flex justify-end gap-3">
          <div class="flex-1 relative group">
            <button
              @click="$emit('save')"
              :disabled="!isFormValid"
              :class="[
                'w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2',
                isFormValid
                  ? 'text-white bg-[#01779b] dark:bg-[#01779b] hover:bg-[#015a77] dark:hover:bg-[#015a77] cursor-pointer'
                  : 'text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50'
              ]"
            >
              <Save class="h-4 w-4" />
              {{ isEdit ? 'Save Changes' : 'Save Minutes' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.minute-editor-drawer {
  transition: max-width 0.3s ease-out, opacity 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}

.drawer-enter-from.minute-editor-drawer,
.drawer-leave-to.minute-editor-drawer {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
}

/* Dropdown animations */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease-out, transform 0.15s ease-out;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>



