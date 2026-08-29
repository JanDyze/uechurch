<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Tag, Plus, Pencil, Trash2, Loader2, Check, X } from 'lucide-vue-next'
import { usePermissions } from '../../composables/usePermissions'
import { useToast } from '../../composables/useToast'
import {
  subscribeToCustomTags,
  addCustomTag,
  renameTag,
  deleteTag,
} from '../../api/tagsService'
import ConfirmationModal from '../common/ConfirmationModal.vue'

const toast = useToast()
const { isAdmin, members } = usePermissions()

const customTags = ref([])
let unsubscribe = null

// No starter set: the useful labels for one congregation mean nothing to the
// next, and the names that used to be seeded here were ministries, which now
// have their own list.
onMounted(() => {
  unsubscribe = subscribeToCustomTags((tags) => {
    customTags.value = tags
  })
})
onUnmounted(() => unsubscribe?.())

const newTagName = ref('')
const busy = ref(null)
const editingTag = ref(null)
const editName = ref('')

// A tag can exist two ways at once: as a memberTags document, or simply typed
// onto a member. Merge them so the page shows every tag the app will honour.
const tags = computed(() => {
  const seen = new Map()

  const add = (name, extra) => {
    if (!name) return
    const key = name.toLowerCase()
    seen.set(key, { ...(seen.get(key) || { name }), ...extra })
  }

  customTags.value.forEach((t) => add(t.name, { name: t.name, customTagId: t.id }))
  members.value.forEach((m) => (m.tags || []).forEach((name) => add(name, { name })))

  return [...seen.values()]
    .map((t) => ({
      ...t,
      memberCount: members.value.filter((m) => (m.tags || []).includes(t.name)).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const existsAlready = (name, ignore = null) =>
  tags.value.some(
    (t) => t.name.toLowerCase() === name.toLowerCase() && t.name !== ignore
  )

const handleAdd = async () => {
  const name = newTagName.value.trim()
  if (!name) return
  if (existsAlready(name)) {
    toast.info('That tag already exists')
    return
  }
  busy.value = 'add'
  try {
    await addCustomTag(name)
    newTagName.value = ''
    toast.success(`"${name}" added`)
  } catch (e) {
    console.error('Error adding tag:', e)
    toast.error('Could not add that tag.')
  } finally {
    busy.value = null
  }
}

const startEdit = (tag) => {
  editingTag.value = tag.name
  editName.value = tag.name
}

const cancelEdit = () => {
  editingTag.value = null
  editName.value = ''
}

const handleRename = async (tag) => {
  const next = editName.value.trim()
  if (!next || next === tag.name) return cancelEdit()
  if (existsAlready(next, tag.name)) {
    toast.info('A tag with that name already exists')
    return
  }
  busy.value = tag.name
  try {
    const touched = await renameTag(tag.name, next, tag.customTagId)
    cancelEdit()
    toast.success(
      touched > 0
        ? `Renamed to "${next}" on ${touched} member${touched === 1 ? '' : 's'}`
        : `Renamed to "${next}"`
    )
  } catch (e) {
    console.error('Error renaming tag:', e)
    toast.error('Could not rename that tag.')
  } finally {
    busy.value = null
  }
}

/* ------------------------------------------------------------ confirmation */
const showConfirmation = ref(false)
const pendingDelete = ref(null)

const confirmMessage = computed(() => {
  const tag = pendingDelete.value
  if (!tag) return ''
  const parts = [`Delete the "${tag.name}" tag?`]
  if (tag.memberCount > 0) {
    parts.push(
      `It will be removed from ${tag.memberCount} member${tag.memberCount === 1 ? '' : 's'}.`
    )
  }
  return parts.join(' ')
})

const askDelete = (tag) => {
  pendingDelete.value = tag
  showConfirmation.value = true
}

const handleDelete = async () => {
  const tag = pendingDelete.value
  if (!tag) return
  busy.value = tag.name
  try {
    await deleteTag(tag.name, tag.customTagId)
    toast.success(`"${tag.name}" deleted`)
  } catch (e) {
    console.error('Error deleting tag:', e)
    toast.error('Could not delete that tag.')
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
        <Tag class="h-5 w-5 text-primary dark:text-primary-light" />
      </div>
      <div class="min-w-0">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Tags</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Descriptive labels for finding and grouping members. They grant no access
        </p>
      </div>
    </div>

    <p v-if="!isAdmin" class="px-4 py-6 text-sm text-center text-gray-500 dark:text-gray-400">
      Only administrators can manage tags.
    </p>

    <template v-else>
      <!-- Add -->
      <div class="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <input
          v-model="newTagName"
          type="text"
          placeholder="New tag name"
          @keydown.enter.prevent="handleAdd"
          class="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        <button
          @click="handleAdd"
          :disabled="!newTagName.trim() || busy === 'add'"
          class="shrink-0 inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-white text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          <Loader2 v-if="busy === 'add'" class="h-4 w-4 animate-spin" />
          <Plus v-else class="h-4 w-4" />
          <span class="hidden sm:inline">Add</span>
        </button>
      </div>

      <ul class="divide-y divide-gray-100 dark:divide-gray-700">
        <li v-for="tag in tags" :key="tag.name" class="px-4 py-3">
          <!-- Rename -->
          <div v-if="editingTag === tag.name" class="flex items-center gap-2">
            <input
              v-model="editName"
              type="text"
              @keydown.enter.prevent="handleRename(tag)"
              @keydown.escape="cancelEdit"
              class="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <button
              @click="handleRename(tag)"
              :disabled="busy === tag.name"
              class="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
              aria-label="Save name"
            >
              <Loader2 v-if="busy === tag.name" class="h-4 w-4 animate-spin" />
              <Check v-else class="h-4 w-4" />
            </button>
            <button
              @click="cancelEdit"
              class="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Cancel"
            >
              <X class="h-4 w-4" />
            </button>
          </div>

          <!-- Row -->
          <div v-else class="flex items-center gap-3">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                {{ tag.name }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ tag.memberCount }} member{{ tag.memberCount === 1 ? '' : 's' }}
              </p>
            </div>

            <button
              @click="startEdit(tag)"
              class="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              :aria-label="`Rename ${tag.name}`"
            >
              <Pencil class="h-4 w-4" />
            </button>
            <button
              @click="askDelete(tag)"
              :disabled="busy === tag.name"
              class="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
              :aria-label="`Delete ${tag.name}`"
            >
              <Loader2 v-if="busy === tag.name" class="h-4 w-4 animate-spin" />
              <Trash2 v-else class="h-4 w-4" />
            </button>
          </div>
        </li>
      </ul>

      <p class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
        Assign tags to people on their member profile. Renaming a tag updates every member
        who holds it and keeps its permissions; deleting one revokes them.
      </p>
    </template>

    <ConfirmationModal
      v-model:show="showConfirmation"
      title="Delete tag"
      :message="confirmMessage"
      confirm-text="Delete"
      confirm-button-class="bg-red-600 text-white hover:bg-red-700"
      @confirm="handleDelete"
    />
  </section>
</template>
