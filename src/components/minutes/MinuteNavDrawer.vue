<script setup>
/**
 * Getting around a minute on a phone.
 *
 * This was a bottom sheet, which is the wrong shape for it. A meeting can have
 * a dozen agenda items; a sheet capped at 80% of a short screen showed four of
 * them and scrolled, while the widest part of the screen sat unused above it.
 * Navigation is a list of things, and a list of things wants height.
 *
 * A side drawer also puts the agenda where the desktop rail is, so the two
 * layouts are the same idea at two sizes rather than two different ideas.
 *
 * It carries the meeting's other actions at the foot, so the header can stop
 * being a row of four unlabelled icons.
 */

import { computed } from 'vue'
import {
  Download, FileText, List, Plus, Trash2, UsersRound, X,
} from '../../icons'

const props = defineProps({
  show: { type: Boolean, default: false },
  agenda: { type: Array, default: () => [] },
  selectedIndex: { type: Number, default: null },
  attendeeCount: { type: Number, default: 0 },
  canEdit: { type: Boolean, default: false },
  // Which items have notes in them, so the drawer says how far the meeting got
  // without opening each one.
  written: { type: Array, default: () => [] },
})

const emit = defineEmits([
  'close', 'select-summary', 'select', 'add', 'attendance', 'export', 'delete',
])

const toRoman = (num) => {
  const table = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ]
  let left = num
  let out = ''
  for (const [value, numeral] of table) {
    while (left >= value) {
      out += numeral
      left -= value
    }
  }
  return out
}

const hasNotes = (index) => props.written.includes(index)
const progress = computed(() => `${props.written.length} of ${props.agenda.length}`)
</script>

<template>
  <Teleport to="body">
    <Transition name="nav-drawer">
      <div v-if="show" class="fixed inset-0 z-80 lg:hidden">
        <div class="absolute inset-0 bg-black/50" @click="emit('close')" />

        <!-- From the right, where the button that opens it lives. A drawer
             that flies in from the opposite side of the thumb reads as a
             different thing arriving. -->
        <aside
          class="nav-drawer-panel absolute inset-y-0 right-0 flex w-[min(20rem,85vw)] flex-col bg-white shadow-2xl dark:bg-gray-800"
        >
          <header
            class="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-4 pb-3 pt-[max(0.875rem,env(safe-area-inset-top))] dark:border-gray-700"
          >
            <div class="min-w-0">
              <h2 class="text-sm font-semibold text-gray-900 dark:text-white">This meeting</h2>
              <p v-if="agenda.length" class="text-xs text-gray-400 dark:text-gray-500">
                Notes on {{ progress }}
              </p>
            </div>
            <button
              @click="emit('close')"
              class="-mr-1 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
              aria-label="Close"
            >
              <X class="h-5 w-5" />
            </button>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto p-3">
            <button
              @click="emit('select-summary')"
              :class="[
                'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors',
                selectedIndex === null
                  ? 'bg-primary text-white'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700',
              ]"
            >
              <FileText
                :class="['h-4.5 w-4.5 shrink-0', selectedIndex === null ? 'text-white' : 'text-primary']"
              />
              Summary
            </button>

            <div class="mt-4 mb-1.5 flex items-center justify-between px-1">
              <h3
                class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500"
              >
                <List class="h-3.5 w-3.5" />
                Agenda
              </h3>
              <button
                v-if="canEdit"
                @click="emit('add')"
                class="flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 dark:text-primary-light"
              >
                <Plus class="h-3.5 w-3.5" />
                Add
              </button>
            </div>

            <nav class="space-y-0.5">
              <button
                v-for="(item, index) in agenda"
                :key="index"
                @click="emit('select', index)"
                :class="[
                  'flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors',
                  selectedIndex === index
                    ? 'bg-primary text-white'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700',
                ]"
              >
                <span
                  :class="[
                    'mt-px shrink-0 text-[11px] font-bold tabular-nums',
                    selectedIndex === index ? 'text-white/80' : 'text-gray-400 dark:text-gray-500',
                  ]"
                >
                  {{ toRoman(index + 1) }}.
                </span>
                <span class="min-w-0 flex-1 text-sm leading-snug">{{ item }}</span>
                <!-- A dot for an item nobody has typed into yet: the one thing
                     you want from a list of agenda items mid-meeting. -->
                <span
                  v-if="!hasNotes(index)"
                  :class="[
                    'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                    selectedIndex === index ? 'bg-white/60' : 'bg-amber-400',
                  ]"
                  :title="'No notes yet'"
                />
              </button>

              <p
                v-if="!agenda.length"
                class="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500"
              >
                No agenda items yet.
              </p>
            </nav>
          </div>

          <!-- The meeting's own actions, which used to be four unlabelled
               icons in the header. Named, and out of the way. -->
          <footer
            class="shrink-0 space-y-0.5 border-t border-gray-200 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] dark:border-gray-700"
          >
            <button
              @click="emit('attendance')"
              class="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <UsersRound class="h-4.5 w-4.5 shrink-0 text-gray-400" />
              <span class="flex-1">Attendance</span>
              <span class="text-xs font-semibold tabular-nums text-gray-400">{{ attendeeCount }}</span>
            </button>
            <button
              @click="emit('export')"
              class="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <Download class="h-4.5 w-4.5 shrink-0 text-gray-400" />
              Export as text
            </button>
            <button
              v-if="canEdit"
              @click="emit('delete')"
              class="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <Trash2 class="h-4.5 w-4.5 shrink-0" />
              Delete these minutes
            </button>
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.nav-drawer-enter-active,
.nav-drawer-leave-active {
  transition: opacity 0.25s ease;
}

.nav-drawer-enter-active .nav-drawer-panel,
.nav-drawer-leave-active .nav-drawer-panel {
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}

.nav-drawer-enter-from,
.nav-drawer-leave-to {
  opacity: 0;
}

.nav-drawer-enter-from .nav-drawer-panel,
.nav-drawer-leave-to .nav-drawer-panel {
  transform: translateX(100%);
}
</style>
