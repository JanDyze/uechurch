<script setup>
import { ref, watch } from 'vue'
import { Plus, X } from '../../icons'
import { useFocusTrap } from '../../composables/useFocusTrap'
import { useToast } from '../../composables/useToast'
import { TICKET_KINDS, kindClasses } from '../../utils/ticketUtils'

const props = defineProps({
  show: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
})

const emit = defineEmits(['update:show', 'save'])

const toast = useToast()

const title = ref('')
const details = ref('')
const kind = ref('feature')
const titleRef = ref(null)

// A drawer that reopens holding the last ticket's text would have you deleting
// someone else's words before writing your own.
watch(
  () => props.show,
  (open) => {
    if (!open) return
    title.value = ''
    details.value = ''
    kind.value = 'feature'
    requestAnimationFrame(() => titleRef.value?.focus())
  }
)

const close = () => emit('update:show', false)

// Validated here rather than by greying out Save: a button that will not press
// and will not say why is the harder thing to debug.
const save = () => {
  const trimmed = title.value.trim()
  if (!trimmed) {
    toast.error('Give the ticket a title first')
    titleRef.value?.focus()
    return
  }
  emit('save', { title: trimmed, details: details.value.trim(), kind: kind.value })
}

const dialogRef = ref(null)
useFocusTrap(dialogRef, () => props.show, close)
</script>

<template>
  <Teleport to="body">
    <Transition name="ticket-drawer">
      <div
        v-if="show"
        class="fixed inset-0 z-120 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
        @click.self="close"
      >
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-drawer-title"
          tabindex="-1"
          class="flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl dark:bg-gray-800 sm:max-w-lg sm:rounded-2xl"
          @click.stop
        >
          <!-- Header -->
          <div
            class="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-4 dark:border-gray-700 sm:px-6"
          >
            <h3
              id="ticket-drawer-title"
              class="text-lg font-semibold text-gray-900 dark:text-white"
            >
              New ticket
            </h3>
            <button
              @click="close"
              aria-label="Close"
              class="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto p-4 sm:p-6">
            <form @submit.prevent="save" class="space-y-4">
              <div>
                <label
                  for="ticket-title"
                  class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  What needs doing <span class="text-red-500">*</span>
                </label>
                <input
                  id="ticket-title"
                  ref="titleRef"
                  v-model="title"
                  type="text"
                  placeholder="Lineup drawer loses the band on save"
                  class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label
                  class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Kind
                </label>
                <div class="flex gap-2">
                  <button
                    v-for="option in TICKET_KINDS"
                    :key="option.key"
                    type="button"
                    @click="kind = option.key"
                    :aria-pressed="kind === option.key"
                    :class="[
                      'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                      kind === option.key
                        ? kindClasses(option.key)
                        : 'bg-gray-100 text-gray-500 hover:text-gray-700 dark:bg-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
                    ]"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>

              <div>
                <label
                  for="ticket-details"
                  class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Details
                </label>
                <textarea
                  id="ticket-details"
                  v-model="details"
                  rows="4"
                  placeholder="Anything worth remembering when you come back to this"
                  class="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-primary placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300"
                ></textarea>
              </div>
            </form>
          </div>

          <!-- Footer. pb clears the phone's home indicator. -->
          <div
            class="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-gray-700 sm:px-6 sm:pb-4"
          >
            <button
              @click="close"
              class="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              @click="save"
              :disabled="saving"
              class="flex items-center gap-2 rounded-lg px-4 py-2 text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              :style="{ background: 'var(--color-primary)' }"
            >
              <Plus class="h-4 w-4" />
              {{ saving ? 'Adding…' : 'Add ticket' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ticket-drawer-enter-active,
.ticket-drawer-leave-active {
  transition: opacity 0.25s ease;
}

.ticket-drawer-enter-from,
.ticket-drawer-leave-to {
  opacity: 0;
}

/* A sheet rises from the bottom on a phone; on a desktop it is a dialog and
   simply fades with its backdrop. */
@media (max-width: 639px) {
  .ticket-drawer-enter-active > div,
  .ticket-drawer-leave-active > div {
    transition: transform 0.25s ease;
  }

  .ticket-drawer-enter-from > div,
  .ticket-drawer-leave-to > div {
    transform: translateY(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ticket-drawer-enter-active,
  .ticket-drawer-leave-active,
  .ticket-drawer-enter-active > div,
  .ticket-drawer-leave-active > div {
    transition: none;
  }
}
</style>
