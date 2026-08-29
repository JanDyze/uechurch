<script setup>
import { computed, onMounted, ref } from 'vue'
import { HandHeart, Plus, Pencil, Trash2, Loader2, Check, X, ShieldCheck } from '../../icons'
import { usePermissions } from '../../composables/usePermissions'
import { useMinistries } from '../../composables/useMinistries'
import { useToast } from '../../composables/useToast'
import ConfirmationModal from '../common/ConfirmationModal.vue'

// Ministries are what people do in the church, and the only thing that grants
// access. Tags are the other list — free-text labels that grant nothing. They
// used to be one list, which meant a label that happened to match a role
// handed out that role's permissions.
const toast = useToast()
const { isAdmin, members, roleMap } = usePermissions()
const { ministries: records, loading, add, rename, remove, seedDefaults } = useMinistries()

onMounted(async () => {
  // A fresh church gets a starter set. Clearing the list is a valid end state,
  // so this only fires when the collection is empty AND nobody is serving in
  // anything — otherwise a church that emptied it would find it repopulated.
  if (!isAdmin.value) return
  try {
    const anyAssigned = members.value.some((m) => (m.ministries || []).length > 0)
    if (!anyAssigned) await seedDefaults()
  } catch (e) {
    console.error('Error seeding default ministries:', e)
  }
})

const newName = ref('')
const busy = ref(null)
const editing = ref(null)
const editName = ref('')

const ministries = computed(() =>
  records.value
    .map((m) => ({
      ...m,
      memberCount: members.value.filter((x) => (x.ministries || []).includes(m.name)).length,
      grantCount: (roleMap.value[m.name] || []).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
)

const existsAlready = (name, ignore = null) =>
  ministries.value.some(
    (m) => m.name.toLowerCase() === name.toLowerCase() && m.name !== ignore
  )

const handleAdd = async () => {
  const name = newName.value.trim()
  if (!name) return
  if (existsAlready(name)) {
    toast.info('That ministry already exists')
    return
  }
  busy.value = 'add'
  try {
    await add(name)
    newName.value = ''
    toast.success(`"${name}" added`)
  } catch (e) {
    console.error('Error adding ministry:', e)
    toast.error('Could not add that ministry.')
  } finally {
    busy.value = null
  }
}

const startEdit = (ministry) => {
  editing.value = ministry.name
  editName.value = ministry.name
}

const cancelEdit = () => {
  editing.value = null
  editName.value = ''
}

const handleRename = async (ministry) => {
  const next = editName.value.trim()
  if (!next || next === ministry.name) return cancelEdit()
  if (existsAlready(next, ministry.name)) {
    toast.info('A ministry with that name already exists')
    return
  }
  busy.value = ministry.name
  try {
    const touched = await rename(ministry.name, next, ministry.id)
    cancelEdit()
    toast.success(
      touched > 0
        ? `Renamed to "${next}" for ${touched} member${touched === 1 ? '' : 's'}`
        : `Renamed to "${next}"`
    )
  } catch (e) {
    console.error('Error renaming ministry:', e)
    toast.error('Could not rename that ministry.')
  } finally {
    busy.value = null
  }
}

/* ------------------------------------------------------------ confirmation */
const showConfirmation = ref(false)
const pendingDelete = ref(null)

const confirmMessage = computed(() => {
  const ministry = pendingDelete.value
  if (!ministry) return ''
  const parts = [`Delete the "${ministry.name}" ministry?`]
  if (ministry.memberCount > 0) {
    parts.push(
      `It will be removed from ${ministry.memberCount} member${ministry.memberCount === 1 ? '' : 's'}.`
    )
  }
  if (ministry.grantCount > 0) {
    parts.push('The access it grants will be revoked from everyone serving in it.')
  }
  return parts.join(' ')
})

const askDelete = (ministry) => {
  pendingDelete.value = ministry
  showConfirmation.value = true
}

const handleDelete = async () => {
  const ministry = pendingDelete.value
  if (!ministry) return
  busy.value = ministry.name
  try {
    const touched = await remove(ministry.name, ministry.id)
    toast.success(
      touched > 0
        ? `Removed from ${touched} member${touched === 1 ? '' : 's'}`
        : `"${ministry.name}" deleted`
    )
  } catch (e) {
    console.error('Error deleting ministry:', e)
    toast.error('Could not delete that ministry.')
  } finally {
    busy.value = null
    pendingDelete.value = null
  }
}
</script>

<template>
  <section
    class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
  >
    <div class="flex items-start gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-700">
      <div class="p-2 rounded-lg bg-primary/10 shrink-0">
        <HandHeart class="h-5 w-5 text-primary dark:text-primary-light" />
      </div>
      <div class="min-w-0">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Ministries</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          What people do in the church &mdash; and the only thing that grants access
        </p>
      </div>
    </div>

    <p v-if="!isAdmin" class="px-4 py-6 text-sm text-center text-gray-500 dark:text-gray-400">
      Only administrators can change ministries.
    </p>

    <template v-else>
      <div
        class="flex items-start gap-2 mx-4 mt-4 rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3 text-xs text-gray-600 dark:text-gray-300"
      >
        <ShieldCheck class="h-4 w-4 shrink-0 text-gray-400 mt-0.5" />
        <p>
          Assign what a ministry can do under
          <span class="font-semibold">Roles</span>. For descriptive labels that grant
          nothing &mdash; "New Convert", "Needs Visit" &mdash; use
          <span class="font-semibold">Tags</span> instead.
        </p>
      </div>

      <!-- Add -->
      <div class="flex gap-2 px-4 pt-4">
        <input
          v-model="newName"
          type="text"
          placeholder="e.g. Sunday School Teacher"
          class="flex-1 h-11 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary"
          @keydown.enter="handleAdd"
        />
        <button
          @click="handleAdd"
          :disabled="!newName.trim() || busy === 'add'"
          class="shrink-0 flex h-11 items-center gap-1.5 rounded-lg bg-primary px-3 text-white shadow-sm transition-transform active:scale-95 disabled:opacity-50"
        >
          <Loader2 v-if="busy === 'add'" class="h-5 w-5 animate-spin" />
          <Plus v-else class="h-5 w-5" />
          <span class="text-sm font-medium">Add</span>
        </button>
      </div>

      <div v-if="loading" class="p-4 space-y-2">
        <div
          v-for="i in 3"
          :key="`ministry-skeleton-${i}`"
          class="h-12 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse"
        ></div>
      </div>

      <p
        v-else-if="!ministries.length"
        class="px-4 py-8 text-sm text-center text-gray-500 dark:text-gray-400"
      >
        No ministries yet. Add one above.
      </p>

      <ul v-else class="mt-4 divide-y divide-gray-100 dark:divide-gray-700">
        <li
          v-for="ministry in ministries"
          :key="ministry.id || ministry.name"
          class="flex items-center gap-3 px-4 py-3"
        >
          <template v-if="editing === ministry.name">
            <input
              v-model="editName"
              type="text"
              class="flex-1 h-10 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary"
              @keydown.enter="handleRename(ministry)"
              @keydown.esc="cancelEdit"
            />
            <button
              @click="handleRename(ministry)"
              :disabled="busy === ministry.name"
              class="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50"
              aria-label="Save"
            >
              <Loader2 v-if="busy === ministry.name" class="h-4 w-4 animate-spin" />
              <Check v-else class="h-4 w-4" />
            </button>
            <button
              @click="cancelEdit"
              class="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Cancel"
            >
              <X class="h-4 w-4" />
            </button>
          </template>

          <template v-else>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                {{ ministry.name }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {{ ministry.memberCount }} member{{ ministry.memberCount === 1 ? '' : 's' }}
                <span v-if="ministry.grantCount">
                  &middot; {{ ministry.grantCount }} permission{{
                    ministry.grantCount === 1 ? '' : 's'
                  }}
                </span>
                <span v-else class="text-gray-400 dark:text-gray-500">&middot; no access granted</span>
              </p>
            </div>
            <button
              @click="startEdit(ministry)"
              class="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              :aria-label="`Rename ${ministry.name}`"
            >
              <Pencil class="h-4 w-4" />
            </button>
            <button
              @click="askDelete(ministry)"
              class="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              :aria-label="`Delete ${ministry.name}`"
            >
              <Trash2 class="h-4 w-4" />
            </button>
          </template>
        </li>
      </ul>
    </template>

    <ConfirmationModal
      :show="showConfirmation"
      title="Delete ministry"
      :message="confirmMessage"
      confirm-text="Delete"
      cancel-text="Cancel"
      confirm-button-class="bg-red-600 text-white hover:bg-red-700"
      @update:show="showConfirmation = $event"
      @confirm="handleDelete"
      @cancel="pendingDelete = null"
    />
  </section>
</template>
