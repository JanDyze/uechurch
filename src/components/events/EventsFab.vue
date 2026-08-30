<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Plus, CalendarPlus, CalendarDays, List, Calendar } from '../../icons'
import { useFocusTrap } from '../../composables/useFocusTrap'
import { usePermissions } from '../../composables/usePermissions'

const props = defineProps({
  // Which of the two month views is showing, so the toggle can name what it
  // will do rather than what is already on screen.
  showMonthEvents: {
    type: Boolean,
    default: false,
  },
})

const { canManage } = usePermissions()

const emit = defineEmits(['add', 'toggleList', 'today'])

const open = ref(false)

const canAdd = computed(() => canManage('events'))

const actions = computed(() => {
  const list = []
  if (canAdd.value) {
    list.push({ key: 'add', label: 'Add event', icon: CalendarPlus, event: 'add' })
  }
  list.push({
    key: 'list',
    label: props.showMonthEvents ? 'Calendar' : 'Month list',
    icon: props.showMonthEvents ? Calendar : List,
    event: 'toggleList',
  })
  list.push({ key: 'today', label: 'Today', icon: CalendarDays, event: 'today' })
  return list
})

// With nothing to choose between, a menu is just an extra tap.
const isSingleAction = computed(() => actions.value.length === 1)

const fabIcon = computed(() => (canAdd.value ? Plus : CalendarDays))

const close = () => {
  open.value = false
}

const toggle = () => {
  if (isSingleAction.value) {
    emit(actions.value[0].event)
    return
  }
  open.value = !open.value
}

const run = (action) => {
  close()
  emit(action.event)
}

const fabRef = ref(null)

// Non-modal: the calendar behind stays live, so Tab is not trapped - Escape
// and focus restoration still come from here.
useFocusTrap(fabRef, open, close, { trap: false })

const handleDocumentClick = (event) => {
  if (!fabRef.value?.contains(event.target)) close()
}

watch(open, (isOpen) => {
  if (isOpen) document.addEventListener('click', handleDocumentClick)
  else document.removeEventListener('click', handleDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<template>
  <div
    ref="fabRef"
    tabindex="-1"
    class="absolute bottom-4 right-4 z-50 flex flex-col items-end gap-2.5 focus:outline-none"
  >
    <Transition name="fab-actions">
      <div v-if="open" role="menu" class="flex flex-col items-end gap-2.5">
        <button
          v-for="action in actions"
          :key="action.key"
          role="menuitem"
          @click="run(action)"
          class="flex items-center gap-2.5 rounded-full bg-white/80 py-1.5 pl-4 pr-1.5 shadow-lg ring-1 ring-gray-200/70 backdrop-blur-xl transition-transform active:scale-95 hover:bg-white dark:bg-gray-800/80 dark:ring-white/10 dark:hover:bg-gray-800"
        >
          <span class="whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
            {{ action.label }}
          </span>
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
          >
            <component :is="action.icon" class="h-5 w-5" />
          </span>
        </button>
      </div>
    </Transition>

    <button
      @click="toggle"
      :aria-expanded="isSingleAction ? undefined : open"
      :aria-haspopup="isSingleAction ? undefined : 'menu'"
      :aria-label="isSingleAction ? actions[0].label : open ? 'Close actions' : 'Event actions'"
      class="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 transition-transform active:scale-95 hover:bg-primary-hover"
    >
      <component
        :is="fabIcon"
        class="h-6 w-6 transition-transform duration-300 ease-in-out"
        :class="{ 'rotate-45': open && canAdd }"
      />
    </button>
  </div>
</template>

<style scoped>
.fab-actions-enter-active,
.fab-actions-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fab-actions-enter-from,
.fab-actions-leave-to {
  opacity: 0;
  transform: translateY(0.5rem) scale(0.95);
  transform-origin: bottom right;
}
</style>
