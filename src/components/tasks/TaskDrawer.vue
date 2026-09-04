<script setup>
import { computed, ref, watch } from 'vue'
import { X, Save, Check, Search, ChevronDown, User, Trash2 } from '../../icons'
import { useMembers } from '../../composables/useMembers'
import { useMinistries } from '../../composables/useMinistries'
import { useMediaQuery } from '../../composables/useMediaQuery'
import { useFocusTrap } from '../../composables/useFocusTrap'
import { TASK_PRIORITIES } from '../../utils/taskUtils'
import { getFullName } from '../../utils/memberUtils'
import { memberKey } from '../../utils/sgUtils'

const isMobile = useMediaQuery('(max-width: 1023px)')

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  isEdit: {
    type: Boolean,
    default: false,
  },
  taskData: {
    type: Object,
    default: () => ({}),
  },
  /** Shown only while editing, so the row's bin is not the only way out. */
  canDelete: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:show', 'update:taskData', 'save', 'cancel', 'delete'])

const { members } = useMembers()
const { ministryNames } = useMinistries()

const patch = (changes) => emit('update:taskData', { ...props.taskData, ...changes })

const isFormValid = computed(() => Boolean(props.taskData.title?.trim()))

/* ------------------------------------------------------------- assignees */

// More than one on purpose: half of what a church writes down is "Ana and Ben
// are bringing the chairs", and a single-owner field turns that into two
// records that drift apart.
const assigneeIds = computed(() => props.taskData.assigneeIds || [])
const assigneeNames = computed(() => props.taskData.assigneeNames || [])

const showMemberDropdown = ref(false)
const memberSearchQuery = ref('')

const availableMembers = computed(() => {
  const taken = new Set(assigneeIds.value.map(String))
  const query = memberSearchQuery.value.trim().toLowerCase()
  return (members.value || []).filter((member) => {
    if (taken.has(memberKey(member))) return false
    if (!query) return true
    const name = getFullName(member).toLowerCase()
    return name.includes(query) || (member.nickname || '').toLowerCase().includes(query)
  })
})

const addAssignee = (member) => {
  patch({
    assigneeIds: [...assigneeIds.value, memberKey(member)],
    assigneeNames: [
      ...assigneeNames.value,
      getFullName(member).trim() || member.nickname || 'Unknown',
    ],
  })
  memberSearchQuery.value = ''
  showMemberDropdown.value = false
}

// Removed by position, not by id: names and ids are stored as parallel arrays
// and have to stay lined up, and the picker never offers someone already on
// the list, so an index can never be ambiguous.
const removeAssignee = (index) => {
  patch({
    assigneeIds: assigneeIds.value.filter((_, i) => i !== index),
    assigneeNames: assigneeNames.value.filter((_, i) => i !== index),
  })
}

const handleClickOutside = (event) => {
  if (!event.target.closest('.assignee-picker')) showMemberDropdown.value = false
}

watch(
  () => props.show,
  (open) => {
    if (open) {
      document.addEventListener('click', handleClickOutside)
    } else {
      document.removeEventListener('click', handleClickOutside)
      showMemberDropdown.value = false
      memberSearchQuery.value = ''
    }
  }
)

const handleSave = () => {
  if (isFormValid.value) emit('save')
}

const handleCancel = () => emit('cancel')

const dialogRef = ref(null)
useFocusTrap(dialogRef, () => props.show, handleCancel)
</script>

<template>
  <Teleport to="body" :disabled="!isMobile">
    <Transition :name="isMobile ? 'modal-sheet' : 'drawer'">
      <div
        v-if="show"
        :class="[
          isMobile
            ? 'fixed inset-0 z-80 flex flex-col justify-end'
            : 'task-drawer m-3 flex h-[calc(100%-1.5rem)] w-[calc(50%-1.5rem)] shrink-0 flex-col overflow-hidden rounded-2xl border-2 border-primary/30 bg-white shadow-xl shadow-primary/25 dark:border-primary-light/30 dark:bg-gray-800 dark:shadow-primary-light/20'
        ]"
      >
        <div v-if="isMobile" class="absolute inset-0 bg-black/50" @click="handleCancel" />
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-drawer-title"
          tabindex="-1"
          :class="[
            'flex min-h-0 flex-col',
            isMobile
              ? 'relative z-10 max-h-[92dvh] w-full rounded-t-2xl border-t border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800'
              : 'h-full w-full'
          ]"
        >
          <div class="flex shrink-0 items-center justify-between rounded-t-2xl border-b border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
            <h3 id="task-drawer-title" class="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
              <Check class="h-5 w-5 text-primary dark:text-primary-light" />
              {{ isEdit ? 'Edit task' : 'New task' }}
            </h3>
            <button
              @click="handleCancel"
              aria-label="Close"
              class="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-4 sm:p-6">
            <form @submit.prevent="handleSave" class="space-y-4">
              <div>
                <label for="task-title" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  What needs doing <span class="text-red-500">*</span>
                </label>
                <input
                  id="task-title"
                  :value="taskData.title"
                  @input="patch({ title: $event.target.value })"
                  type="text"
                  required
                  placeholder="Print the bulletins"
                  class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div class="assignee-picker relative">
                <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Who is doing it
                </label>
                <div v-if="assigneeNames.length" class="mb-2 flex flex-wrap gap-1.5">
                  <span
                    v-for="(name, index) in assigneeNames"
                    :key="assigneeIds[index] + '-' + index"
                    class="flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-2.5 pr-1 text-sm text-primary dark:bg-primary/20 dark:text-primary-light"
                  >
                    {{ name }}
                    <button
                      type="button"
                      @click="removeAssignee(index)"
                      class="rounded-full p-0.5 hover:bg-primary/20"
                      :aria-label="'Remove ' + name"
                    >
                      <X class="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
                <div class="relative">
                  <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    v-model="memberSearchQuery"
                    @focus="showMemberDropdown = true"
                    type="text"
                    :placeholder="assigneeNames.length ? 'Add someone else...' : 'Search people...'"
                    class="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-9 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                  <ChevronDown class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                  <Transition name="dropdown">
                    <div
                      v-if="showMemberDropdown && availableMembers.length"
                      class="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800"
                    >
                      <button
                        v-for="member in availableMembers"
                        :key="memberKey(member)"
                        type="button"
                        @click="addAssignee(member)"
                        class="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <User class="h-4 w-4 shrink-0 text-gray-400" />
                        <span class="min-w-0">
                          <span class="block truncate text-sm text-gray-900 dark:text-white">
                            {{ getFullName(member).trim() || 'Unknown' }}
                          </span>
                          <span v-if="member.nickname" class="block truncate text-xs text-gray-500 dark:text-gray-400">
                            {{ member.nickname }}
                          </span>
                        </span>
                      </button>
                    </div>
                  </Transition>
                </div>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Anyone listed here can tick it off themselves.
                </p>
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label for="task-due" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Due
                  </label>
                  <input
                    id="task-due"
                    :value="taskData.dueDate"
                    @input="patch({ dueDate: $event.target.value })"
                    type="date"
                    class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label for="task-priority" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Priority
                  </label>
                  <select
                    id="task-priority"
                    :value="taskData.priority"
                    @change="patch({ priority: $event.target.value })"
                    class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <option v-for="option in TASK_PRIORITIES" :key="option.key" :value="option.key">
                      {{ option.label }}
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label for="task-ministry" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Ministry
                </label>
                <select
                  id="task-ministry"
                  :value="taskData.ministry"
                  @change="patch({ ministry: $event.target.value })"
                  class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">No particular ministry</option>
                  <option v-for="name in ministryNames" :key="name" :value="name">{{ name }}</option>
                </select>
              </div>

              <div>
                <label for="task-details" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Details
                </label>
                <textarea
                  id="task-details"
                  :value="taskData.details"
                  @input="patch({ details: $event.target.value })"
                  rows="4"
                  placeholder="Anything the person picking this up needs to know..."
                  class="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                ></textarea>
              </div>

              <p v-if="isEdit && taskData.done && taskData.doneByName" class="text-sm text-gray-500 dark:text-gray-400">
                Ticked off by {{ taskData.doneByName }}.
              </p>
            </form>
          </div>

          <div class="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 px-4 py-4 dark:border-gray-700 sm:px-6">
            <button
              v-if="isEdit && canDelete"
              @click="emit('delete')"
              class="mr-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <Trash2 class="h-4 w-4" />
              Delete
            </button>
            <button
              @click="handleCancel"
              class="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              @click="handleSave"
              :disabled="!isFormValid"
              :class="[
                'flex items-center gap-2 rounded-lg px-4 py-2 transition-colors',
                isFormValid
                  ? 'bg-primary text-white hover:bg-primary-hover'
                  : 'cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-600 dark:text-gray-400'
              ]"
            >
              <Save class="h-4 w-4" />
              {{ isEdit ? 'Update' : 'Save' }}
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
  transition: transform 0.3s ease-out;
}

.drawer-enter-from,
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
