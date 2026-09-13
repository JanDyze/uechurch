<script setup>
/**
 * Who is serving how often this month — the fairness check, before publishing.
 *
 * It was a strip across the top of the lineup page, which put it in front of
 * everyone on every visit when only whoever is assigning ever needs it. Now it
 * is a sheet, opened on purpose, and it counts every role rather than only the
 * leaders and the band: the usher on four Sundays running is the same problem
 * as the drummer on four.
 */
import { ref } from 'vue'
import { Users, X } from '../../icons'
import { useFocusTrap } from '../../composables/useFocusTrap'
import MemberAvatar from '../members/MemberAvatar.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  rows: { type: Array, default: () => [] },
  sundayCount: { type: Number, default: 0 },
  monthLabel: { type: String, default: '' },
})

const emit = defineEmits(['close'])

const dialogRef = ref(null)
useFocusTrap(dialogRef, () => props.show, () => emit('close'))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 z-100 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
        @click.self="emit('close')"
      >
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-roster-title"
          tabindex="-1"
          class="flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl sm:max-w-md sm:rounded-2xl dark:border-gray-700 dark:bg-gray-800"
        >
          <div
            class="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-linear-to-r from-primary/10 to-transparent px-4 py-3.5 dark:border-gray-700 dark:from-primary-light/10"
          >
            <div class="flex min-w-0 items-center gap-3">
              <div class="shrink-0 rounded-xl bg-primary p-2.5 shadow-lg shadow-primary/30">
                <Users class="h-5 w-5 text-white" />
              </div>
              <div class="min-w-0">
                <h2
                  id="schedule-roster-title"
                  class="truncate text-base font-bold text-gray-900 dark:text-white"
                >
                  Who&rsquo;s serving
                </h2>
                <p class="truncate text-xs text-gray-500 dark:text-gray-400">
                  {{ monthLabel }} · out of {{ sundayCount }}
                  {{ sundayCount === 1 ? 'Sunday' : 'Sundays' }}
                </p>
              </div>
            </div>
            <button
              @click="emit('close')"
              aria-label="Close"
              class="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <ul
            v-if="rows.length"
            class="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto pb-[max(0.5rem,env(safe-area-inset-bottom))] dark:divide-gray-700/60"
          >
            <li v-for="row in rows" :key="row.id" class="flex items-center gap-3 px-4 py-2.5">
              <MemberAvatar v-if="row.member" :member="row.member" alt="" size="h-8 w-8" />
              <span
                v-else
                class="h-8 w-8 shrink-0 rounded-full bg-gray-100 dark:bg-gray-700"
              />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {{ row.name }}
                </span>
                <span class="block truncate text-xs text-gray-500 dark:text-gray-400">
                  {{
                    row.roles
                      .map((r) => (r.count > 1 ? `${r.name} ×${r.count}` : r.name))
                      .join(' · ')
                  }}
                </span>
              </span>
              <!-- Marked only when it is every Sunday of the month: a fixed
                   threshold would mean different things in a four-Sunday
                   month and a five-Sunday one. -->
              <span
                :class="[
                  'shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums',
                  sundayCount > 1 && row.count >= sundayCount
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
                ]"
              >
                ×{{ row.count }}
              </span>
            </li>
          </ul>
          <p v-else class="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Nobody is scheduled this month yet.
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
