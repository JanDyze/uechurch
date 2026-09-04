import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  subscribeToTasks,
  addTask,
  updateTask,
  setTaskDone,
  deleteTask,
} from '../api/tasksService'
import { isAssignedTo, isDueToday, isOverdue, todayKey } from '../utils/taskUtils'

// Shared across callers, like useMinistries: the Tasks page and the dashboard
// tile both want the same list, and there is no reason for each to open its
// own Firestore listener.
const tasks = ref([])
const loading = ref(true)
let unsubscribe = null
let subscribers = 0

export function useTasks() {
  onMounted(() => {
    subscribers += 1
    if (unsubscribe) return
    unsubscribe = subscribeToTasks((data) => {
      tasks.value = data
      loading.value = false
    })
  })

  onUnmounted(() => {
    subscribers -= 1
    if (subscribers <= 0 && unsubscribe) {
      unsubscribe()
      unsubscribe = null
      subscribers = 0
    }
  })

  const openTasks = computed(() => tasks.value.filter((task) => !task.done))
  const overdueTasks = computed(() => openTasks.value.filter((task) => isOverdue(task)))
  const dueTodayTasks = computed(() => openTasks.value.filter((task) => isDueToday(task)))

  /** What one person still owes, which is the only count worth a dashboard. */
  const tasksFor = (memberId) => openTasks.value.filter((task) => isAssignedTo(task, memberId))

  return {
    tasks,
    loading,
    openTasks,
    overdueTasks,
    dueTodayTasks,
    tasksFor,
    today: todayKey(),
    addTask,
    updateTask,
    setTaskDone,
    removeTask: deleteTask,
  }
}
