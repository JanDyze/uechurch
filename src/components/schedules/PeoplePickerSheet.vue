<script setup>
/**
 * Putting people on one role for one Sunday.
 *
 * Everyone on the roll is offered, members and attendees alike — a visiting
 * musician or a parent covering Sunday school is still somebody the church
 * needs to write down. But whoever already serves in the role's ministries is
 * listed first, because nine times out of ten that is who is being looked for.
 * The lineup's band picker hid everyone else behind a "Show all members"
 * toggle; a second heading costs a scroll instead of a tap and a guess.
 *
 * Somebody already doing something else that Sunday is marked rather than
 * hidden. Leading and playing on the same morning is normal; being put on the
 * door as well is worth a second look, not worth forbidding.
 */
import { computed, ref, watch } from 'vue'
import { Check, Search, Users, X } from '../../icons'
import { useFocusTrap } from '../../composables/useFocusTrap'
import { getDisplayName, getFullName } from '../../utils/memberUtils'
import { memberKey } from '../../utils/sgUtils'
import { servesInRole } from '../../utils/lineupUtils'
import MemberAvatar from '../members/MemberAvatar.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  role: { type: Object, default: null },
  members: { type: Array, default: () => [] },
  // Who is on this role right now.
  selectedIds: { type: Array, default: () => [] },
  // id -> the other roles they hold this Sunday, for the "also" hint.
  elsewhere: { type: Object, default: () => ({}) },
  // The song leader is one person: choosing replaces and closes.
  single: { type: Boolean, default: false },
})

const emit = defineEmits(['update:show', 'toggle', 'choose'])

const dialogRef = ref(null)
const search = ref('')

watch(
  () => props.show,
  (open) => {
    if (open) search.value = ''
  }
)

const close = () => emit('update:show', false)
useFocusTrap(dialogRef, computed(() => props.show), close)

const selected = computed(() => new Set(props.selectedIds.map(String)))
const isSelected = (member) => selected.value.has(memberKey(member))

const byName = (a, b) => getDisplayName(a).localeCompare(getDisplayName(b))

/** Name, nickname and ministries: typing "usher" finds the ushers too. */
const matches = (member, q) =>
  !q ||
  [getFullName(member), member.nickname, ...(member.ministries || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(q)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return props.members.filter((m) => matches(m, q))
})

const suggested = computed(() =>
  filtered.value.filter((m) => servesInRole(m, props.role)).sort(byName)
)
const others = computed(() =>
  filtered.value.filter((m) => !servesInRole(m, props.role)).sort(byName)
)

const hasMinistries = computed(() => (props.role?.ministries || []).length > 0)
const ministryLabel = computed(() => (props.role?.ministries || []).join(', '))

const sections = computed(() => {
  if (!hasMinistries.value) return [{ key: 'all', label: '', people: others.value }]
  return [
    { key: 'suggested', label: `Serving in ${ministryLabel.value}`, people: suggested.value },
    { key: 'others', label: 'Everyone else', people: others.value },
  ].filter((section) => section.people.length)
})

const alsoOn = (member) => props.elsewhere[memberKey(member)] || []

const pick = (member) => {
  if (props.single) {
    emit('choose', isSelected(member) ? null : memberKey(member))
    close()
    return
  }
  emit('toggle', memberKey(member))
}

const clearSingle = () => {
  emit('choose', null)
  close()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="picker">
      <div
        v-if="show && role"
        class="fixed inset-0 z-90 flex flex-col justify-end sm:items-center sm:justify-center"
      >
        <div class="absolute inset-0 bg-black/50" @click="close" />

        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="people-picker-title"
          tabindex="-1"
          class="relative z-10 flex max-h-[88dvh] w-full flex-col rounded-t-2xl border-t border-gray-200 bg-white shadow-2xl sm:max-h-[80dvh] sm:max-w-lg sm:rounded-2xl sm:border dark:border-gray-700 dark:bg-gray-800"
        >
          <div
            class="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-700"
          >
            <div class="min-w-0">
              <h3
                id="people-picker-title"
                class="truncate text-base font-semibold text-gray-900 dark:text-white"
              >
                {{ role.name }}
              </h3>
              <p class="truncate text-xs text-gray-500 dark:text-gray-400">
                {{ single ? 'Pick one person' : `${selectedIds.length} chosen` }}
              </p>
            </div>
            <button
              @click="close"
              class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              aria-label="Close"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <div class="shrink-0 px-4 pb-2 pt-3">
            <div class="relative">
              <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                v-model="search"
                type="text"
                inputmode="search"
                enterkeyhint="search"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                placeholder="Name or ministry"
                aria-label="Search people"
                class="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            <button
              v-if="single && selectedIds.length"
              type="button"
              @click="clearSingle"
              class="flex w-full items-center gap-3 rounded-xl p-3 text-left text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/50"
            >
              <span
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700"
              >
                <X class="h-4 w-4" />
              </span>
              Nobody yet
            </button>

            <p
              v-if="!sections.some((s) => s.people.length)"
              class="p-8 text-center text-sm text-gray-500 dark:text-gray-400"
            >
              <Users class="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
              Nobody matches.
            </p>

            <section v-for="section in sections" :key="section.key">
              <p
                v-if="section.label"
                class="sticky top-0 z-10 truncate bg-white px-2 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:bg-gray-800"
              >
                {{ section.label }}
              </p>
              <button
                v-for="member in section.people"
                :key="memberKey(member)"
                type="button"
                @click="pick(member)"
                :aria-pressed="isSelected(member)"
                :class="[
                  'flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors',
                  isSelected(member)
                    ? 'bg-primary/10'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50',
                ]"
              >
                <MemberAvatar :member="member" alt="" size="h-8 w-8" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium text-gray-900 dark:text-white">
                    {{ getDisplayName(member) }}
                  </span>
                  <span class="block truncate text-xs text-gray-500 dark:text-gray-400">
                    <template v-if="alsoOn(member).length">
                      <span class="font-semibold text-amber-600 dark:text-amber-400">
                        Also {{ alsoOn(member).join(', ') }}
                      </span>
                    </template>
                    <template v-else>
                      {{ getFullName(member) }}{{ member.isMember ? '' : ' · Attendee' }}
                    </template>
                  </span>
                </span>
                <span
                  :class="[
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                    isSelected(member)
                      ? 'border-primary bg-primary text-white'
                      : 'border-gray-300 dark:border-gray-600',
                  ]"
                >
                  <Check v-if="isSelected(member)" class="h-4 w-4" />
                </span>
              </button>
            </section>
          </div>

          <div
            v-if="!single"
            class="shrink-0 border-t border-gray-100 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-gray-700"
          >
            <button
              @click="close"
              class="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.picker-enter-active,
.picker-leave-active {
  transition: opacity 0.2s ease;
}
.picker-enter-from,
.picker-leave-to {
  opacity: 0;
}
</style>
