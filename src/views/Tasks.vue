<script setup>
import { computed, ref } from 'vue'
import TasksToolbar from '../components/tasks/TasksToolbar.vue'
import TaskQuickAdd from '../components/tasks/TaskQuickAdd.vue'
import TaskListItem from '../components/tasks/TaskListItem.vue'
import TaskDrawer from '../components/tasks/TaskDrawer.vue'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'
import { ChevronDown, ChevronRight, SearchX, Check } from '../icons'
import { useTasks } from '../composables/useTasks'
import { usePermissions } from '../composables/usePermissions'
import { useAuth } from '../composables/useAuth'
import { useToast } from '../composables/useToast'
import { getFullName } from '../utils/memberUtils'
import { memberKey } from '../utils/sgUtils'
import {
  DUE_BUCKETS,
  compareDone,
  compareTasks,
  dueBucket,
  isAssignedTo,
  matchesTaskQuery,
  todayKey,
} from '../utils/taskUtils'

// The shared list of what the church still has to do.
//
// Grouped by when a thing is due rather than by who owns it, because "what is
// late" is the question this page is opened to answer and no other grouping
// answers it. Who, which ministry, and how urgent are details on the row —
// and the search bar reaches every one of them, including the words a row
// only displays: "overdue", "unassigned", "done".

const { tasks, loading, addTask, updateTask, setTaskDone, removeTask } = useTasks()
const { canManage, myMember } = usePermissions()
const { user } = useAuth()
const toast = useToast()

const today = todayKey()

const canEdit = computed(() => canManage('tasks'))
const myMemberId = computed(() => (myMember.value ? memberKey(myMember.value) : null))

// Ticking a box is not editing: the person a task was handed to has to be able
// to say it is done without also being trusted to rewrite the list.
const canComplete = (task) => canEdit.value || isAssignedTo(task, myMemberId.value)

/** Who the app records as having ticked something off. */
const meAs = computed(() => ({
  uid: user.value?.uid || '',
  name: myMember.value
    ? getFullName(myMember.value).trim()
    : user.value?.displayName || user.value?.email || 'Someone',
}))

/* ----------------------------------------------------------------- state */

const searchQuery = ref('')
const scope = ref('all')
const showDone = ref(false)

const showAddTask = ref(false)
const showEditTask = ref(false)
const editingTask = ref(null)
const selectedTaskId = ref(null)

const emptyTask = () => ({
  title: '',
  details: '',
  assigneeIds: [],
  assigneeNames: [],
  ministry: '',
  dueDate: '',
  priority: 'normal',
  done: false,
})

const taskForm = ref(emptyTask())

/* ------------------------------------------------------------------ lists */

const myOpenCount = computed(
  () => tasks.value.filter((task) => !task.done && isAssignedTo(task, myMemberId.value)).length
)

const inScope = computed(() =>
  scope.value === 'mine'
    ? tasks.value.filter((task) => isAssignedTo(task, myMemberId.value))
    : tasks.value
)

const matching = computed(() =>
  inScope.value.filter((task) => matchesTaskQuery(task, searchQuery.value, today))
)

/** The open list, in due-date order, with empty groups dropped entirely. */
const openGroups = computed(() => {
  const open = matching.value.filter((task) => !task.done)
  return DUE_BUCKETS.map((bucket) => ({
    ...bucket,
    tasks: open.filter((task) => dueBucket(task, today) === bucket.key).sort(compareTasks),
  })).filter((bucket) => bucket.tasks.length > 0)
})

const doneTasks = computed(() =>
  matching.value.filter((task) => task.done).sort(compareDone)
)

const openCount = computed(() => openGroups.value.reduce((n, g) => n + g.tasks.length, 0))
const nothingToShow = computed(() => !loading.value && !openCount.value && !doneTasks.value.length)

/* --------------------------------------------------------------- editing */

const closeDrawer = () => {
  showAddTask.value = false
  showEditTask.value = false
  editingTask.value = null
  selectedTaskId.value = null
  taskForm.value = emptyTask()
}

const handleNewTask = () => {
  if (showAddTask.value) {
    closeDrawer()
    return
  }
  taskForm.value = emptyTask()
  editingTask.value = null
  selectedTaskId.value = null
  showEditTask.value = false
  showAddTask.value = true
}

const handleTaskClick = (task) => {
  if (!canEdit.value) return
  const { id, firestoreId, createdAt, updatedAt, doneAt, ...rest } = task
  taskForm.value = { ...emptyTask(), ...rest }
  editingTask.value = task
  selectedTaskId.value = task.id
  showAddTask.value = false
  showEditTask.value = true
}

/** The one-line box at the top of the list: a title, and nothing else yet. */
const handleQuickAdd = async (title, done) => {
  try {
    await addTask({
      ...emptyTask(),
      title,
      createdBy: meAs.value.uid,
      createdByName: meAs.value.name,
    })
    done(true)
  } catch (error) {
    console.error('Error adding task:', error)
    toast.error('Could not add that task. Please try again.')
    done(false)
  }
}

const handleSaveTask = async () => {
  try {
    if (showEditTask.value && editingTask.value) {
      // Everything the drawer edits, and nothing it does not: the tick and who
      // made it belong to the checkbox, and writing a stale copy of them back
      // would undo whoever ticked the box while this was open.
      const { done, doneBy, doneByName, ...edits } = taskForm.value
      await updateTask(editingTask.value, edits)
    } else {
      await addTask({
        ...taskForm.value,
        createdBy: meAs.value.uid,
        createdByName: meAs.value.name,
      })
    }
    closeDrawer()
  } catch (error) {
    console.error('Error saving task:', error)
    toast.error('Could not save that task. Please try again.')
  }
}

const handleToggleDone = async (task) => {
  try {
    await setTaskDone(task, !task.done, meAs.value)
  } catch (error) {
    console.error('Error updating task:', error)
    toast.error('Could not update that task. Please try again.')
  }
}

/* -------------------------------------------------------------- deleting */

const showConfirmation = ref(false)
const pendingDelete = ref(null)

// Built here rather than in the attribute: the title is user text and lands
// between quotes, which is not a thing to assemble inside a template.
const deleteMessage = computed(
  () => `Delete "${pendingDelete.value?.title || 'this task'}"? This cannot be undone.`
)

const askToDelete = (task) => {
  pendingDelete.value = task
  showConfirmation.value = true
}

const confirmDelete = async () => {
  const task = pendingDelete.value
  showConfirmation.value = false
  if (!task) return
  try {
    await removeTask(task)
    if (editingTask.value && editingTask.value.id === task.id) closeDrawer()
  } catch (error) {
    console.error('Error deleting task:', error)
    toast.error('Could not delete that task. Please try again.')
  } finally {
    pendingDelete.value = null
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <TasksToolbar
      :search-query="searchQuery"
      :scope="scope"
      :show-scope="Boolean(myMemberId)"
      :mine-count="myOpenCount"
      :show-add-task="showAddTask"
      @update:search-query="searchQuery = $event"
      @update:scope="scope = $event"
      @new-task="handleNewTask"
    />

    <!-- Outside the scroller on purpose: the box you add to should not be a
         thing you scroll back up to find. -->
    <TaskQuickAdd v-if="canEdit" @add="handleQuickAdd" />

    <div class="relative flex flex-1 overflow-hidden">
      <div class="flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div v-if="loading" class="p-8 text-center text-gray-500 dark:text-gray-400">
          Loading tasks...
        </div>

        <div
          v-else-if="nothingToShow"
          class="flex flex-col items-center justify-center px-8 py-16 text-center text-gray-500 dark:text-gray-400"
        >
          <SearchX v-if="searchQuery" class="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
          <Check v-else class="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p class="mb-1 text-lg">
            <template v-if="searchQuery">Nothing matches "{{ searchQuery }}"</template>
            <template v-else-if="scope === 'mine'">Nothing is assigned to you</template>
            <template v-else>Nothing on the list</template>
          </p>
          <p class="text-sm">
            <template v-if="searchQuery">Try a name, a ministry, or a word from the task.</template>
            <template v-else-if="scope === 'mine'">Switch to Everyone to see what the church is working on.</template>
            <template v-else-if="canEdit">Type in the box above to add the first one.</template>
            <template v-else>Someone will add tasks here as they come up.</template>
          </p>
        </div>

        <template v-else>
          <!-- Everything outstanding is cleared, but the page is not empty —
               say so, rather than leaving a lone "Done" header to be read as
               the whole list. -->
          <div
            v-if="!openCount"
            class="border-b border-gray-100 px-4 py-8 text-center dark:border-gray-700"
          >
            <p class="text-base font-medium text-gray-900 dark:text-white">Nothing outstanding</p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ scope === 'mine' ? 'You are all caught up.' : 'Everything on the list has been ticked off.' }}
            </p>
          </div>

          <template v-for="group in openGroups" :key="group.key">
            <div
              :class="[
                'sticky top-0 z-10 flex items-center justify-between border-b px-4 py-2',
                group.key === 'overdue'
                  ? 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/20'
                  : 'border-gray-200 bg-gray-100 dark:border-gray-600 dark:bg-gray-700'
              ]"
            >
              <h3
                :class="[
                  'text-sm font-semibold uppercase tracking-wide',
                  group.key === 'overdue'
                    ? 'text-red-700 dark:text-red-300'
                    : 'text-gray-700 dark:text-gray-300'
                ]"
              >
                {{ group.label }}
              </h3>
              <span
                :class="[
                  'text-xs font-semibold',
                  group.key === 'overdue'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-500 dark:text-gray-400'
                ]"
              >{{ group.tasks.length }}</span>
            </div>
            <div class="divide-y divide-gray-100 dark:divide-gray-700/60">
              <TaskListItem
                v-for="task in group.tasks"
                :key="task.id"
                :task="task"
                :today="today"
                :selected="selectedTaskId === task.id"
                :can-complete="canComplete(task)"
                :can-edit="canEdit"
                @click="handleTaskClick"
                @toggle="handleToggleDone"
                @delete="askToDelete"
              />
            </div>
          </template>

          <!-- Collapsed by default. What is finished is worth keeping and not
               worth scrolling past every time the page is opened. -->
          <template v-if="doneTasks.length">
            <button
              @click="showDone = !showDone"
              class="sticky top-0 z-10 flex w-full items-center gap-2 border-b border-gray-200 bg-gray-100 px-4 py-2 text-left transition-colors hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
              :aria-expanded="showDone"
            >
              <component :is="showDone ? ChevronDown : ChevronRight" class="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
              <h3 class="flex-1 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
                Done
              </h3>
              <span class="text-xs font-semibold text-gray-500 dark:text-gray-400">
                {{ doneTasks.length }}
              </span>
            </button>
            <div v-if="showDone" class="divide-y divide-gray-100 dark:divide-gray-700/60">
              <TaskListItem
                v-for="task in doneTasks"
                :key="task.id"
                :task="task"
                :today="today"
                :selected="selectedTaskId === task.id"
                :can-complete="canComplete(task)"
                :can-edit="canEdit"
                @click="handleTaskClick"
                @toggle="handleToggleDone"
                @delete="askToDelete"
              />
            </div>
          </template>
        </template>
      </div>

      <TaskDrawer
        :show="showAddTask || showEditTask"
        :is-edit="showEditTask"
        :task-data="taskForm"
        :can-delete="canEdit"
        @update:show="(open) => { if (!open) closeDrawer() }"
        @update:task-data="taskForm = $event"
        @save="handleSaveTask"
        @cancel="closeDrawer"
        @delete="askToDelete(editingTask)"
      />
    </div>

    <ConfirmationModal
      :show="showConfirmation"
      title="Delete task"
      :message="deleteMessage"
      confirm-text="Delete"
      cancel-text="Cancel"
      confirm-button-class="bg-red-600 text-white hover:bg-red-700"
      @update:show="showConfirmation = $event"
      @confirm="confirmDelete"
      @cancel="showConfirmation = false"
    />
  </div>
</template>
