<script setup>
// The same island the People and Minutes pages use. The month header already
// carries what has to be seen at a glance — which month, and whether it is
// published — so everything that is an action rather than a state lives here.
//
// Search leads, because "when am I on?" is the question most visits are.

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ListChecks, Plus, ProjectorScreen, Search, Users } from '../../icons'
import { useFocusTrap } from '../../composables/useFocusTrap'

const props = defineProps({
  // Only planners need the fairness check; only administrators shape the roles.
  canPlan: { type: Boolean, default: false },
  canEditRoles: { type: Boolean, default: false },
})

const emit = defineEmits(['search', 'roster', 'roles', 'present'])

const open = ref(false)

const actions = computed(() => {
  const list = [{ key: 'search', label: 'Search', icon: Search, event: 'search' }]
  if (props.canPlan) {
    list.push({ key: 'roster', label: 'Who’s serving', icon: Users, event: 'roster' })
  }
  if (props.canEditRoles) {
    list.push({ key: 'roles', label: 'Roles', icon: ListChecks, event: 'roles' })
  }
  // Into the tech booth. Viewing is enough: presenting shows what the worship
  // team planned, it does not change it.
  list.push({ key: 'present', label: 'Present', icon: ProjectorScreen, event: 'present' })
  return list
})

const close = () => {
  open.value = false
}

const toggle = () => {
  open.value = !open.value
}

const run = (action) => {
  close()
  emit(action.event)
}

const fabRef = ref(null)

// Non-modal: the page behind stays live, so Tab is not trapped — Escape and
// focus restoration still come from here.
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
      :aria-expanded="open"
      aria-haspopup="menu"
      :aria-label="open ? 'Close actions' : 'Schedule actions'"
      class="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 transition-transform active:scale-95 hover:bg-primary-hover"
    >
      <Plus
        class="h-6 w-6 transition-transform duration-300 ease-in-out"
        :class="{ 'rotate-45': open }"
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
