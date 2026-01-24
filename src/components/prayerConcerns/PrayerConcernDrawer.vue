<script setup>
import { computed, ref, watch } from 'vue'
import { X, Save, Heart, User, Search, ChevronDown } from 'lucide-vue-next'
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
  concernData: {
    type: Object,
    default: () => ({
      title: '',
      memberId: '',
      memberName: '',
      description: '',
      status: 'active',
      priority: 'normal',
      date: '',
      notes: ''
    })
  }
})

const emit = defineEmits(['update:show', 'update:concernData', 'save', 'cancel'])

const { members } = useMembers()

const isFormValid = computed(() => {
  return props.concernData.title && props.concernData.title.trim().length > 0
})

const filteredMembers = computed(() => {
  return members.value || []
})

// Searchable dropdown state
const showMemberDropdown = ref(false)
const memberSearchQuery = ref('')

const availableMembers = computed(() => {
  if (!memberSearchQuery.value.trim()) {
    return filteredMembers.value
  }
  const query = memberSearchQuery.value.toLowerCase()
  return filteredMembers.value.filter(member => {
    const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim().toLowerCase()
    const nickname = (member.nickname || '').toLowerCase()
    return fullName.includes(query) || nickname.includes(query)
  })
})

const selectMember = (member) => {
  emit('update:concernData', {
    ...props.concernData,
    memberId: member.id || member.firestoreId,
    memberName: `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.nickname || 'Unknown'
  })
  showMemberDropdown.value = false
  memberSearchQuery.value = ''
}

const clearMember = () => {
  emit('update:concernData', {
    ...props.concernData,
    memberId: '',
    memberName: ''
  })
  showMemberDropdown.value = false
  memberSearchQuery.value = ''
}

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  if (!event.target.closest('.member-dropdown-container')) {
    showMemberDropdown.value = false
  }
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    document.addEventListener('click', handleClickOutside)
    if (!props.concernData.date) {
      emit('update:concernData', {
        ...props.concernData,
        date: new Date().toISOString().split('T')[0]
      })
    }
  } else {
    document.removeEventListener('click', handleClickOutside)
    showMemberDropdown.value = false
    memberSearchQuery.value = ''
  }
})

const handleSave = () => {
  if (isFormValid.value) {
    emit('save')
  }
}

const handleCancel = () => {
  emit('cancel')
}
</script>

<template>
  <Transition name="drawer">
    <div
      v-if="show"
      class="prayer-concern-drawer border-l-4 border-[#01779b] bg-white dark:bg-gray-800 w-1/2 h-full flex flex-col flex-shrink-0 shadow-2xl shadow-[#01779b]/20"
    >
      <!-- Header -->
      <div class="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Heart class="h-5 w-5 text-red-600 dark:text-red-400" />
          {{ isEdit ? 'Edit Prayer Concern' : 'Add Prayer Concern' }}
        </h3>
        <button
          @click="handleCancel"
          class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <!-- Scrollable Form Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <form @submit.prevent="handleSave" class="space-y-4">
          <!-- Title -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title <span class="text-red-500">*</span>
            </label>
            <input
              :value="concernData.title"
              @input="$emit('update:concernData', { ...concernData, title: $event.target.value })"
              type="text"
              required
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
              placeholder="Prayer concern title"
            />
          </div>

          <!-- Member Selection -->
          <div class="member-dropdown-container relative">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Member (Optional)
            </label>
            <div class="relative">
              <div
                v-if="concernData.memberName"
                class="flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <div class="flex items-center gap-2">
                  <User class="h-4 w-4 text-gray-400" />
                  <span class="text-sm text-gray-900 dark:text-white">{{ concernData.memberName }}</span>
                </div>
                <button
                  type="button"
                  @click="clearMember"
                  class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X class="h-4 w-4" />
                </button>
              </div>
              <div v-else class="relative">
                <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  v-model="memberSearchQuery"
                  @focus="showMemberDropdown = true"
                  type="text"
                  placeholder="Search members..."
                  class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
                />
                <ChevronDown class="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
              
              <!-- Dropdown -->
              <Transition name="dropdown">
                <div
                  v-if="showMemberDropdown && availableMembers.length > 0"
                  class="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                >
                  <button
                    v-for="member in availableMembers"
                    :key="member.id || member.firestoreId"
                    type="button"
                    @click="selectMember(member)"
                    class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <User class="h-4 w-4 text-gray-400" />
                    <div>
                      <p class="text-sm text-gray-900 dark:text-white">
                        {{ `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Unknown' }}
                      </p>
                      <p v-if="member.nickname" class="text-xs text-gray-500 dark:text-gray-400">
                        {{ member.nickname }}
                      </p>
                    </div>
                  </button>
                </div>
              </Transition>
            </div>
          </div>

          <!-- Description -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              :value="concernData.description"
              @input="$emit('update:concernData', { ...concernData, description: $event.target.value })"
              rows="4"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent resize-none"
              placeholder="Details about the prayer concern..."
            ></textarea>
          </div>

          <!-- Status -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              :value="concernData.status"
              @change="$emit('update:concernData', { ...concernData, status: $event.target.value })"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
            >
              <option value="active">Active</option>
              <option value="ongoing">Ongoing</option>
              <option value="answered">Answered</option>
            </select>
          </div>

          <!-- Priority -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Priority
            </label>
            <select
              :value="concernData.priority"
              @change="$emit('update:concernData', { ...concernData, priority: $event.target.value })"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <!-- Date -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date
            </label>
            <input
              :value="concernData.date"
              @input="$emit('update:concernData', { ...concernData, date: $event.target.value })"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
            />
          </div>

          <!-- Notes -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              :value="concernData.notes"
              @input="$emit('update:concernData', { ...concernData, notes: $event.target.value })"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent resize-none"
              placeholder="Additional notes..."
            ></textarea>
          </div>
        </form>
      </div>

      <!-- Footer -->
      <div class="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-end gap-3">
        <button
          @click="handleCancel"
          class="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
        <button
          @click="handleSave"
          :disabled="!isFormValid"
          :class="[
            'px-4 py-2 rounded-lg transition-colors flex items-center gap-2',
            isFormValid
              ? 'bg-[#01779b] text-white hover:bg-[#015a77]'
              : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
          ]"
        >
          <Save class="h-4 w-4" />
          {{ isEdit ? 'Update' : 'Save' }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.3s ease-out;
}

.drawer-enter-from {
  transform: translateX(100%);
}

.drawer-leave-to {
  transform: translateX(100%);
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>

