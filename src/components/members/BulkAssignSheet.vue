<script setup>
import { computed, ref, watch } from 'vue'
import { X, Check, Plus } from '../../icons'
import { useFocusTrap } from '../../composables/useFocusTrap'

// Putting one label on a group in a single pass — a tag, or a ministry. The
// counts on the right are the whole point: "8 of 34" says it is already on part
// of this selection, so nobody has to guess whether tapping will add or remove.
//
// One sheet for both, but they are not the same thing and the props say so: a
// tag can be invented on the spot because it grants nothing, while a ministry
// comes from the controlled list in Settings and carries a note about what
// joining it hands out.

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  /** The people the action applies to — full member records, not ids. */
  members: {
    type: Array,
    default: () => [],
  },
  /** Which array on the member record this sheet reads and writes. */
  field: {
    type: String,
    default: 'tags',
  },
  /** Strings, or { name, hint } when an option needs a line of its own. */
  options: {
    type: Array,
    default: () => [],
  },
  title: {
    type: String,
    required: true,
  },
  hint: {
    type: String,
    default: '',
  },
  /** Shown above the list when the action carries a consequence. */
  note: {
    type: String,
    default: '',
  },
  icon: {
    type: [Object, Function],
    default: null,
  },
  /** Only for a vocabulary anyone may extend — tags, never ministries. */
  allowCreate: {
    type: Boolean,
    default: false,
  },
  createPlaceholder: {
    type: String,
    default: 'New tag',
  },
  emptyText: {
    type: String,
    default: 'Nothing to choose from yet.',
  },
  busy: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'apply'])

const dialogRef = ref(null)
useFocusTrap(dialogRef, () => props.show, () => emit('close'))

const newValue = ref('')
watch(
  () => props.show,
  (open) => {
    if (!open) newValue.value = ''
  }
)

const total = computed(() => props.members.length)

const items = computed(() =>
  props.options.map((option) =>
    typeof option === 'string' ? { name: option, hint: '' } : option
  )
)

const has = (member, name) =>
  (member?.[props.field] || []).some(
    (value) => String(value).toLowerCase() === name.toLowerCase()
  )

const countFor = (name) => props.members.filter((member) => has(member, name)).length

/** Everyone already has it, so the tap that follows takes it off. */
const isOnAll = (name) => total.value > 0 && countFor(name) === total.value

const toggle = (name) => {
  if (props.busy) return
  emit('apply', { value: name, mode: isOnAll(name) ? 'remove' : 'add' })
}

// Something nobody has yet: worth offering, since the reason to tag thirty
// people at once is usually that the group is new.
const isNew = computed(() => {
  const name = newValue.value.trim().toLowerCase()
  return Boolean(name) && !items.value.some((item) => item.name.toLowerCase() === name)
})

const applyNew = () => {
  const name = newValue.value.trim()
  if (!name || props.busy) return
  emit('apply', { value: name, mode: 'add', register: isNew.value })
  newValue.value = ''
}
</script>

<template>
  <Transition name="modal">
    <div
      v-if="show"
      class="fixed inset-0 z-100 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4"
      @click.self="$emit('close')"
    >
      <div
        ref="dialogRef"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-assign-title"
        tabindex="-1"
        class="w-full sm:max-w-md max-h-[85dvh] flex flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border border-gray-200 dark:border-gray-700"
      >
        <!-- Header -->
        <div
          class="shrink-0 px-4 py-4 bg-linear-to-r from-primary/10 to-transparent dark:from-primary-light/10 border-b border-gray-200 dark:border-gray-700"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div
                v-if="icon"
                class="p-2.5 rounded-xl bg-primary shadow-lg shadow-primary/30 shrink-0"
              >
                <component :is="icon" class="h-5 w-5 text-white" />
              </div>
              <div class="min-w-0">
                <h2
                  id="bulk-assign-title"
                  class="text-base font-bold text-gray-900 dark:text-white truncate"
                >
                  {{ title }}
                </h2>
                <p v-if="hint" class="text-xs text-gray-500 dark:text-gray-400">
                  {{ hint }}
                </p>
              </div>
            </div>
            <button
              @click="$emit('close')"
              aria-label="Close"
              class="shrink-0 p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X class="h-5 w-5" />
            </button>
          </div>
        </div>

        <!-- What this costs, when it costs anything -->
        <p
          v-if="note"
          class="shrink-0 px-4 py-2.5 text-xs text-amber-800 bg-amber-50 border-b border-amber-100 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/20"
        >
          {{ note }}
        </p>

        <!-- New value -->
        <div
          v-if="allowCreate"
          class="shrink-0 px-4 py-3 border-b border-gray-100 dark:border-gray-700"
        >
          <div class="flex gap-2">
            <input
              v-model="newValue"
              type="text"
              :placeholder="createPlaceholder"
              enterkeyhint="done"
              @keyup.enter="applyNew"
              class="flex-1 h-11 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary"
            />
            <button
              @click="applyNew"
              :disabled="!newValue.trim() || busy"
              :class="[
                'h-11 px-4 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 transition-colors',
                newValue.trim() && !busy
                  ? 'bg-primary text-white hover:bg-primary-hover'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed',
              ]"
            >
              <Plus class="h-4 w-4" />
              Add
            </button>
          </div>
        </div>

        <!-- The list -->
        <div class="flex-1 overflow-y-auto p-2">
          <p
            v-if="!items.length"
            class="p-6 text-center text-sm text-gray-500 dark:text-gray-400"
          >
            {{ emptyText }}
          </p>

          <button
            v-for="item in items"
            :key="item.name"
            type="button"
            @click="toggle(item.name)"
            :disabled="busy"
            class="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50"
          >
            <span
              :class="[
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                isOnAll(item.name)
                  ? 'bg-primary border-primary text-white'
                  : countFor(item.name)
                    ? 'border-primary text-primary dark:text-primary-light'
                    : 'border-gray-300 dark:border-gray-600 text-transparent',
              ]"
            >
              <!-- Part of the selection has it: a dot, not a tick, so "some"
                   never reads as "done". -->
              <Check v-if="isOnAll(item.name)" class="h-4 w-4" />
              <span
                v-else-if="countFor(item.name)"
                class="h-2 w-2 rounded-full bg-current"
              ></span>
            </span>

            <span class="flex-1 min-w-0">
              <span class="block text-sm font-medium text-gray-900 dark:text-white truncate">
                {{ item.name }}
              </span>
              <span
                v-if="item.hint"
                class="block text-xs text-gray-500 dark:text-gray-400 truncate"
              >
                {{ item.hint }}
              </span>
            </span>

            <span class="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">
              {{ countFor(item.name) }} of {{ total }}
            </span>
          </button>
        </div>

        <!-- Footer -->
        <div
          class="shrink-0 px-4 py-3 border-t border-gray-200 dark:border-gray-700 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <button
            @click="$emit('close')"
            class="w-full h-11 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors"
          >
            {{ busy ? 'Saving…' : 'Done' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
