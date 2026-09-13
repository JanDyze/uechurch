<script setup>
/**
 * The roles a Sunday is staffed with, for administrators to shape.
 *
 * On the Schedules page rather than in Settings, because the moment somebody
 * notices "we have no row for the WLA coaches" is the moment they are looking
 * at a schedule. A bottom sheet on a phone and a centred card on a desktop,
 * like the People page's sort sheet.
 *
 * Every change saves as it is made, the way the ministries list does: there is
 * no half-edited list of roles worth keeping a Save button for.
 *
 * Each role can point at ministries. That grants nothing and restricts nothing
 * — it only decides who the people picker lists first, so tying Ushers to the
 * Usher ministry means the ushers are at the top when it is time to fill it.
 */
import { computed, ref, watch } from 'vue'
import {
  Check,
  ChevronDown,
  ChevronUp,
  ListChecks,
  Pencil,
  Plus,
  Trash2,
  X,
} from '../../icons'
import { useFocusTrap } from '../../composables/useFocusTrap'
import { useAppSettings } from '../../composables/useAppSettings'
import { useMinistries } from '../../composables/useMinistries'
import { useToast } from '../../composables/useToast'
import { isWorshipRole, roleIdFor } from '../../data/scheduleRoles'
import ConfirmationModal from '../common/ConfirmationModal.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])

const toast = useToast()
const { scheduleRoles, saveScheduleRoles } = useAppSettings()
const { ministryNames } = useMinistries()

const dialogRef = ref(null)
useFocusTrap(dialogRef, () => props.show, () => emit('close'))

const roles = computed(() => scheduleRoles.value)

/** The role opened out for editing, by id. One at a time keeps the list short. */
const openId = ref(null)
const editName = ref('')
const newName = ref('')
const busy = ref(false)

watch(
  () => props.show,
  (open) => {
    if (!open) return
    openId.value = null
    newName.value = ''
  }
)

const toggleOpen = (role) => {
  if (openId.value === role.id) {
    openId.value = null
    return
  }
  openId.value = role.id
  editName.value = role.name
}

const nameTaken = (name, ignoreId = null) =>
  roles.value.some((r) => r.id !== ignoreId && r.name.toLowerCase() === name.toLowerCase())

/** Writes the whole list, which is how its order is kept. */
const write = async (next, success) => {
  busy.value = true
  try {
    await saveScheduleRoles(next)
    if (success) toast.success(success)
  } catch (error) {
    console.error('Error saving schedule roles:', error)
    toast.error('Could not save the roles.')
  } finally {
    busy.value = false
  }
}

const handleAdd = async () => {
  const name = newName.value.trim()
  if (!name || busy.value) return
  if (nameTaken(name)) {
    toast.info('That role already exists')
    return
  }
  const role = { id: roleIdFor(name, roles.value), name, ministries: [] }
  await write([...roles.value, role], `"${name}" added`)
  newName.value = ''
  // Straight into choosing its ministries, which is the next thing anyone does.
  openId.value = role.id
  editName.value = role.name
}

const handleRename = async (role) => {
  const name = editName.value.trim()
  if (!name || name === role.name) return
  if (nameTaken(name, role.id)) {
    toast.info('A role with that name already exists')
    return
  }
  // The id stays: it is what every service already on file is keyed by.
  await write(
    roles.value.map((r) => (r.id === role.id ? { ...r, name } : r)),
    `Renamed to "${name}"`
  )
}

const toggleMinistry = (role, ministry) => {
  const has = role.ministries.some((m) => m.toLowerCase() === ministry.toLowerCase())
  const ministries = has
    ? role.ministries.filter((m) => m.toLowerCase() !== ministry.toLowerCase())
    : [...role.ministries, ministry]
  write(roles.value.map((r) => (r.id === role.id ? { ...r, ministries } : r)))
}

const move = (index, delta) => {
  const target = index + delta
  if (target < 0 || target >= roles.value.length) return
  const next = [...roles.value]
  ;[next[index], next[target]] = [next[target], next[index]]
  write(next)
}

/** A ministry the role names that the church no longer has, kept visible so it
 *  can be unticked rather than lingering unseen. */
const ministryOptions = (role) => {
  const known = ministryNames.value
  const stale = role.ministries.filter(
    (m) => !known.some((k) => k.toLowerCase() === m.toLowerCase())
  )
  return [...known, ...stale]
}

const hasMinistry = (role, ministry) =>
  role.ministries.some((m) => m.toLowerCase() === ministry.toLowerCase())

/* ------------------------------------------------------------ removal */
const pendingRemove = ref(null)
const showConfirm = ref(false)

const askRemove = (role) => {
  pendingRemove.value = role
  showConfirm.value = true
}

const confirmMessage = computed(() => {
  const role = pendingRemove.value
  if (!role) return ''
  return (
    `Remove "${role.name}" from every schedule? Anyone already down for it stays on ` +
    `record but is no longer shown. Add a role with the same name again and they come back.`
  )
})

const handleRemove = async () => {
  const role = pendingRemove.value
  if (!role || isWorshipRole(role.id)) return
  await write(
    roles.value.filter((r) => r.id !== role.id),
    `"${role.name}" removed`
  )
  pendingRemove.value = null
  openId.value = null
}
</script>

<template>
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
        aria-labelledby="schedule-roles-title"
        tabindex="-1"
        class="flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl sm:max-w-md sm:rounded-2xl dark:border-gray-700 dark:bg-gray-800"
      >
        <div
          class="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-linear-to-r from-primary/10 to-transparent px-4 py-3.5 dark:border-gray-700 dark:from-primary-light/10"
        >
          <div class="flex min-w-0 items-center gap-3">
            <div class="shrink-0 rounded-xl bg-primary p-2.5 shadow-lg shadow-primary/30">
              <ListChecks class="h-5 w-5 text-white" />
            </div>
            <div class="min-w-0">
              <h2
                id="schedule-roles-title"
                class="truncate text-base font-bold text-gray-900 dark:text-white"
              >
                Roles
              </h2>
              <p class="truncate text-xs text-gray-500 dark:text-gray-400">
                What each Sunday is staffed with, in this order
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

        <ul class="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-700/60">
          <li v-for="(role, index) in roles" :key="role.id">
            <div class="flex items-center gap-2 px-3 py-2.5">
              <div class="flex shrink-0 flex-col">
                <button
                  type="button"
                  @click="move(index, -1)"
                  :disabled="index === 0 || busy"
                  class="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-25 dark:hover:text-gray-200"
                  :aria-label="`Move ${role.name} up`"
                >
                  <ChevronUp class="h-4 w-4" />
                </button>
                <button
                  type="button"
                  @click="move(index, 1)"
                  :disabled="index === roles.length - 1 || busy"
                  class="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-25 dark:hover:text-gray-200"
                  :aria-label="`Move ${role.name} down`"
                >
                  <ChevronDown class="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                @click="toggleOpen(role)"
                :aria-expanded="openId === role.id"
                class="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-semibold text-gray-900 dark:text-white">
                    {{ role.name }}
                  </span>
                  <span class="block truncate text-xs text-gray-500 dark:text-gray-400">
                    {{
                      role.ministries.length
                        ? `Suggests ${role.ministries.join(', ')}`
                        : 'Suggests nobody in particular'
                    }}
                  </span>
                </span>
                <Pencil class="h-4 w-4 shrink-0 text-gray-400" />
              </button>
            </div>

            <!-- Opened out: the name, the ministries, and removal -->
            <div
              v-if="openId === role.id"
              class="space-y-3 bg-gray-50 px-4 pb-4 pt-3 dark:bg-gray-900/40"
            >
              <form class="flex gap-2" @submit.prevent="handleRename(role)">
                <input
                  v-model="editName"
                  type="text"
                  maxlength="40"
                  :aria-label="`Rename ${role.name}`"
                  class="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
                <button
                  type="submit"
                  :disabled="busy || !editName.trim() || editName.trim() === role.name"
                  class="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-40"
                >
                  <Check class="h-4 w-4" />
                  Rename
                </button>
              </form>

              <div>
                <p class="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                  List these ministries first
                </p>
                <div v-if="ministryOptions(role).length" class="flex flex-wrap gap-1.5">
                  <button
                    v-for="ministry in ministryOptions(role)"
                    :key="ministry"
                    type="button"
                    @click="toggleMinistry(role, ministry)"
                    :disabled="busy"
                    :aria-pressed="hasMinistry(role, ministry)"
                    :class="[
                      'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                      hasMinistry(role, ministry)
                        ? 'bg-primary text-white'
                        : 'bg-white text-gray-600 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700',
                    ]"
                  >
                    {{ ministry }}
                  </button>
                </div>
                <p v-else class="text-xs text-gray-500 dark:text-gray-400">
                  No ministries yet. Add them in Settings.
                </p>
              </div>

              <p v-if="isWorshipRole(role.id)" class="text-xs text-gray-500 dark:text-gray-400">
                The songs depend on this role, so it can be renamed and moved but not removed.
              </p>
              <button
                v-else
                type="button"
                @click="askRemove(role)"
                :disabled="busy"
                class="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <Trash2 class="h-3.5 w-3.5" />
                Remove role
              </button>
            </div>
          </li>
        </ul>

        <form
          class="flex shrink-0 gap-2 border-t border-gray-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-gray-700"
          @submit.prevent="handleAdd"
        >
          <input
            v-model="newName"
            type="text"
            maxlength="40"
            placeholder="New role, e.g. Sound"
            aria-label="New role"
            class="h-11 min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
          <button
            type="submit"
            :disabled="busy || !newName.trim()"
            class="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-40"
          >
            <Plus class="h-4 w-4" />
            Add
          </button>
        </form>
      </div>
    </div>
  </Transition>

  <ConfirmationModal
    :show="showConfirm"
    title="Remove role"
    :message="confirmMessage"
    confirm-text="Remove"
    confirm-button-class="bg-red-600 text-white hover:bg-red-700"
    @update:show="showConfirm = $event"
    @confirm="handleRemove"
    @cancel="showConfirm = false"
  />
</template>
