<script setup>
import { computed, ref, watch } from 'vue'
import { Building2, Plus, X, Loader2, Info } from '../../icons'
import { usePermissions } from '../../composables/usePermissions'
import { useAppSettings } from '../../composables/useAppSettings'
import { useToast } from '../../composables/useToast'
import ChurchLogoPicker from './ChurchLogoPicker.vue'

const toast = useToast()
const { isAdmin } = usePermissions()
const { church, categories, saveChurch, saveCategories } = useAppSettings()

const form = ref({ ...church.value })
const savingChurch = ref(false)

// The stored document arrives after first render, and may change from another
// device — resync the form unless the user is mid-edit.
watch(church, (next) => {
  if (!dirty.value) form.value = { ...next }
})

const dirty = computed(
  () =>
    form.value.shortName !== church.value.shortName ||
    form.value.fullName !== church.value.fullName ||
    form.value.branch !== church.value.branch
)

const handleSaveChurch = async () => {
  if (!form.value.shortName.trim()) {
    toast.error('The short name cannot be empty.')
    return
  }
  savingChurch.value = true
  try {
    await saveChurch({
      shortName: form.value.shortName.trim(),
      fullName: form.value.fullName.trim(),
      branch: form.value.branch.trim(),
    })
    toast.success('Church details saved')
  } catch (e) {
    console.error('Error saving church details:', e)
    toast.error('Could not save. Please try again.')
  } finally {
    savingChurch.value = false
  }
}

/* ------------------------------------------------------------- categories */
const LISTS = [
  { key: 'gallery', label: 'Gallery albums', hint: 'Album categories in the photo gallery' },
  { key: 'links', label: 'Links', hint: 'How saved links are grouped' },
  { key: 'songs', label: 'Song list', hint: 'Song categories' },
  { key: 'eventTypes', label: 'Event types', hint: 'Used by the calendar and attendance' },
]

const newEntry = ref({})
const savingList = ref(null)

const persist = async (key, values) => {
  savingList.value = key
  try {
    await saveCategories({ ...categories.value, [key]: values })
  } catch (e) {
    console.error('Error saving categories:', e)
    toast.error('Could not save that change.')
  } finally {
    savingList.value = null
  }
}

const addEntry = (key) => {
  const value = (newEntry.value[key] || '').trim()
  if (!value) return
  const current = categories.value[key] || []
  if (current.some((v) => v.toLowerCase() === value.toLowerCase())) {
    toast.info('That entry already exists')
    return
  }
  newEntry.value = { ...newEntry.value, [key]: '' }
  persist(key, [...current, value])
}

const removeEntry = (key, value) => {
  persist(
    key,
    (categories.value[key] || []).filter((v) => v !== value)
  )
}
</script>

<template>
  <section
    class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
  >
    <div class="flex items-start gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-700">
      <div class="p-2 rounded-lg bg-primary/10 shrink-0">
        <Building2 class="h-5 w-5 text-primary dark:text-primary-light" />
      </div>
      <div class="min-w-0">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Church</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          The name on every screen and printed report, and the category lists
        </p>
      </div>
    </div>

    <p v-if="!isAdmin" class="px-4 py-6 text-sm text-center text-gray-500 dark:text-gray-400">
      Only administrators can change church details.
    </p>

    <template v-else>
      <div class="p-4 space-y-3 border-b border-gray-100 dark:border-gray-700">
        <!-- Saves on pick, like the category lists: there is nothing to type
             alongside it, so it does not belong behind the Save button. -->
        <ChurchLogoPicker />

        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Short name
          </label>
          <input
            v-model="form.shortName"
            type="text"
            class="w-full h-11 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary"
          />
          <p class="mt-1 text-[11px] text-gray-400">Sidebar, sign-in screen, spreadsheet filenames</p>
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Full legal name
          </label>
          <input
            v-model="form.fullName"
            type="text"
            class="w-full h-11 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Branch or outreach
          </label>
          <input
            v-model="form.branch"
            type="text"
            class="w-full h-11 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary"
          />
          <p class="mt-1 text-[11px] text-gray-400">
            The full name and branch form the letterhead on printed forms and exports
          </p>
        </div>

        <button
          @click="handleSaveChurch"
          :disabled="!dirty || savingChurch"
          class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-white text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          <Loader2 v-if="savingChurch" class="h-4 w-4 animate-spin" />
          Save
        </button>
      </div>

      <!-- Category vocabularies -->
      <div class="p-4 space-y-5">
        <div
          class="flex items-start gap-2 rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3 text-xs text-gray-600 dark:text-gray-300"
        >
          <Info class="h-4 w-4 shrink-0 text-gray-400 mt-0.5" />
          <p>
            Removing a category does not change records already filed under it — they keep
            the old label until you edit them.
          </p>
        </div>

        <div v-for="list in LISTS" :key="list.key">
          <p class="text-xs font-semibold text-gray-700 dark:text-gray-200">{{ list.label }}</p>
          <p class="text-[11px] text-gray-400 mb-2">{{ list.hint }}</p>

          <div class="flex flex-wrap gap-1.5 mb-2">
            <span
              v-for="value in categories[list.key]"
              :key="value"
              class="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-700 dark:text-gray-200"
            >
              {{ value }}
              <button
                @click="removeEntry(list.key, value)"
                :disabled="savingList === list.key"
                class="rounded-full p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                :aria-label="`Remove ${value}`"
              >
                <X class="h-3 w-3" />
              </button>
            </span>
            <span
              v-if="!categories[list.key] || categories[list.key].length === 0"
              class="text-xs italic text-gray-400"
            >
              None
            </span>
          </div>

          <div class="flex items-center gap-2">
            <input
              :value="newEntry[list.key] || ''"
              @input="newEntry = { ...newEntry, [list.key]: $event.target.value }"
              @keydown.enter.prevent="addEntry(list.key)"
              type="text"
              :placeholder="`Add to ${list.label.toLowerCase()}`"
              class="flex-1 min-w-0 h-10 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary"
            />
            <button
              @click="addEntry(list.key)"
              :disabled="!(newEntry[list.key] || '').trim() || savingList === list.key"
              class="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
              :aria-label="`Add to ${list.label}`"
            >
              <Loader2 v-if="savingList === list.key" class="h-4 w-4 animate-spin" />
              <Plus v-else class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
