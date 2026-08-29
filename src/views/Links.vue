<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Link2,
  Plus,
  X,
  MoreHorizontal,
  ExternalLink,
  Trash2,
  Pencil,
  Copy,
  Check,
  Globe,
  Youtube,
  Facebook,
  Instagram,
  FileText,
  Video,
  Palette,
  Loader2,
  ListFilter,
  SearchX,
  AlertTriangle,
} from 'lucide-vue-next'
import { subscribeToLinks, addLink, updateLink, deleteLink } from '../api/linksService'
import { useMediaQuery } from '../composables/useMediaQuery'
import { useFocusTrap } from '../composables/useFocusTrap'
import { useToast } from '../composables/useToast'
import { copyText } from '../utils/clipboard'
import { normalizeUrl, hostLabel, isOpenableUrl, faviconUrl } from '../utils/linkUtils'
import SearchBar from '../components/common/SearchBar.vue'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'
import { usePermissions } from '../composables/usePermissions'
import { useAppSettings } from '../composables/useAppSettings'
import { withAllOption } from '../data/appDefaults'

const { canManage } = usePermissions()
const toast = useToast()

const isMobile = useMediaQuery('(max-width: 1023px)')

// State
const searchQuery = ref('')
const mobileSearchOpen = ref(false)
const selectedCategory = ref('All')
const links = ref([])
const isLoading = ref(true)
const showFilterDropdown = ref(false)
const showForm = ref(false)
const isEditing = ref(false)
const isSubmitting = ref(false)
const copiedId = ref(null)
// Favicons come from a third party and are the first thing to fail offline, so
// every failure is remembered and the row falls back to a drawn icon.
const faviconErrors = ref({})

// One row's actions, in a sheet rather than a popover: the list scrolls, and an
// absolutely positioned menu on the last row was being clipped by it.
const actionsFor = ref(null)

// Form state
const initialForm = {
  title: '',
  url: '',
  category: 'Video',
  description: ''
}
const form = ref({ ...initialForm })

// Delete confirmation
const showConfirmation = ref(false)
const linkToDelete = ref(null)

// Categories
const { categories: appCategories } = useAppSettings()
const categories = computed(() => withAllOption(appCategories.value.links))

// Subscription
let unsubscribeLinks = null

onMounted(() => {
  isLoading.value = true
  unsubscribeLinks = subscribeToLinks((data) => {
    links.value = data
    isLoading.value = false
  })
  window.addEventListener('click', closeMenus)
})

onUnmounted(() => {
  if (unsubscribeLinks) unsubscribeLinks()
  window.removeEventListener('click', closeMenus)
})

const closeMenus = () => {
  showFilterDropdown.value = false
}

const hasFilters = computed(
  () => searchQuery.value.trim().length > 0 || selectedCategory.value !== 'All'
)

const clearFilters = () => {
  searchQuery.value = ''
  selectedCategory.value = 'All'
  mobileSearchOpen.value = false
}

const filteredLinks = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return links.value.filter((link) => {
    if (selectedCategory.value !== 'All' && link.category !== selectedCategory.value) return false
    if (!query) return true
    return [link.title, link.description, link.url, link.category].some((field) =>
      String(field || '').toLowerCase().includes(query)
    )
  })
})

// Grouped by category, in the order an administrator arranged them in Settings.
// The headings do the work the old per-row category pill was doing, and leave
// the row itself to the title and where it points.
const groupedLinks = computed(() => {
  const order = appCategories.value.links || []
  const buckets = new Map()
  filteredLinks.value.forEach((link) => {
    const key = link.category || 'Uncategorised'
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(link)
  })
  const rank = (name) => {
    const index = order.indexOf(name)
    return index === -1 ? order.length : index
  }
  return [...buckets.entries()]
    .map(([category, items]) => ({ category, items }))
    .sort((a, b) => rank(a.category) - rank(b.category) || a.category.localeCompare(b.category))
})

const getIcon = (url, category) => {
  const u = String(url || '').toLowerCase()
  if (u.includes('youtube.com') || u.includes('youtu.be')) return Youtube
  if (u.includes('facebook.com')) return Facebook
  if (u.includes('instagram.com')) return Instagram
  if (u.includes('canva.com')) return Palette
  if (u.includes('drive.google.com') || u.includes('docs.')) return FileText
  if (category === 'Video') return Video
  return Globe
}

const CATEGORY_STYLES = {
  Video: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10',
  Social: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/10',
  Resource: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10',
  Worship: 'text-primary bg-primary/10 dark:text-primary-light',
  Document: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10',
  Design: 'text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-500/10',
  Official: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-500/10',
}

const FALLBACK_STYLES = [
  'text-teal-600 bg-teal-50 dark:text-teal-400 dark:bg-teal-500/10',
  'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-500/10',
  'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-500/10',
  'text-lime-600 bg-lime-50 dark:text-lime-400 dark:bg-lime-500/10',
  'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-500/10',
]

// Categories are renameable in Settings, so a colour has to exist for names
// this file has never heard of. Deriving it from the name keeps it the same
// colour on every visit and on everyone's phone.
const categoryStyle = (category) => {
  if (CATEGORY_STYLES[category]) return CATEGORY_STYLES[category]
  let hash = 0
  for (const char of String(category || '')) hash = (hash * 31 + char.charCodeAt(0)) % 9973
  return FALLBACK_STYLES[hash % FALLBACK_STYLES.length]
}

const openActions = (link) => {
  actionsFor.value = link
}

const closeActions = () => {
  actionsFor.value = null
}

const actionsSheetRef = ref(null)
useFocusTrap(actionsSheetRef, computed(() => actionsFor.value !== null), closeActions)

const formDialogRef = ref(null)
useFocusTrap(formDialogRef, showForm, () => { showForm.value = false })

const handleAdd = () => {
  form.value = { ...initialForm, category: appCategories.value.links?.[0] || initialForm.category }
  isEditing.value = false
  showForm.value = true
}

const handleEdit = (link) => {
  form.value = { ...link }
  isEditing.value = true
  closeActions()
  showForm.value = true
}

const canSubmit = computed(
  () => form.value.title.trim().length > 0 && isOpenableUrl(form.value.url)
)

const handleSubmit = async () => {
  if (!canSubmit.value || isSubmitting.value) return
  isSubmitting.value = true
  const payload = {
    title: form.value.title.trim(),
    // Stored ready to open: someone typing "youtube.com/..." into the field
    // would otherwise be saving a link the browser reads as a path on this site.
    url: normalizeUrl(form.value.url),
    category: form.value.category,
    description: (form.value.description || '').trim(),
  }
  try {
    if (isEditing.value) {
      await updateLink(form.value.id, payload)
      toast.success('Link updated')
    } else {
      await addLink(payload)
      toast.success('Link added')
    }
    showForm.value = false
  } catch (error) {
    console.error('Error saving link:', error)
    toast.error('Could not save that link. Please try again.')
  } finally {
    isSubmitting.value = false
  }
}

const askDelete = (link) => {
  linkToDelete.value = link
  closeActions()
  showConfirmation.value = true
}

const confirmDelete = async () => {
  const link = linkToDelete.value
  if (!link) return
  try {
    await deleteLink(link.id)
    toast.success('Link deleted')
  } catch (error) {
    console.error('Error deleting link:', error)
    toast.error('Could not delete that link. Please try again.')
  }
  // Deliberately left set: the modal names the link while it fades out, and the
  // next delete overwrites it anyway.
}

const copyLink = async (link) => {
  if (await copyText(normalizeUrl(link.url))) {
    copiedId.value = link.id
    setTimeout(() => {
      if (copiedId.value === link.id) copiedId.value = null
    }, 2000)
    toast.success('Link copied')
  } else {
    toast.error('Could not copy the link.')
  }
  closeActions()
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden bg-transparent">

    <!-- Action Bar -->
    <div class="sticky top-0 z-40 mb-2 shrink-0 rounded-xl border border-gray-200/80 bg-white/95 px-2 py-2 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 sm:px-3">
      <div class="flex items-center justify-between gap-2 w-full flex-nowrap">
        <SearchBar v-model="searchQuery" v-model:open="mobileSearchOpen" placeholder="Search links..." />

        <div :class="['flex items-center gap-1.5 sm:gap-2 flex-nowrap shrink-0 ml-auto', mobileSearchOpen ? 'hidden lg:flex' : 'flex']">
          <div class="relative">
            <button
              @click.stop="showFilterDropdown = !showFilterDropdown"
              :class="[
                'flex h-10 items-center justify-center gap-1.5 rounded-lg border border-transparent px-2.5 transition-colors shrink-0',
                selectedCategory !== 'All'
                  ? 'bg-primary text-white'
                  : 'w-10 px-0 bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              ]"
              :aria-label="selectedCategory === 'All' ? 'Filter by category' : `Filtered by ${selectedCategory}`"
            >
              <ListFilter class="h-5 w-5 shrink-0" />
              <span v-if="selectedCategory !== 'All'" class="text-sm font-semibold whitespace-nowrap">{{ selectedCategory }}</span>
            </button>

            <Transition name="fade">
              <div v-if="showFilterDropdown" class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 py-2 overflow-hidden">
                <button
                  v-for="cat in categories"
                  :key="cat"
                  @click="selectedCategory = cat; showFilterDropdown = false"
                  :class="[
                    'block w-full px-4 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-gray-50 dark:hover:bg-gray-700',
                    selectedCategory === cat ? 'text-primary bg-primary/5' : 'text-gray-600 dark:text-gray-300'
                  ]"
                >
                  {{ cat }}
                </button>
              </div>
            </Transition>
          </div>
          <button
            v-if="canManage('links')"
            @click="handleAdd"
            class="flex h-10 items-center justify-center rounded-lg bg-primary text-white shadow-sm transition-colors hover:bg-primary-hover px-2.5 sm:px-4 gap-1.5 w-10 sm:w-auto shrink-0"
          >
            <Plus class="h-5 w-5 shrink-0" /> <span class="hidden sm:inline whitespace-nowrap">Add</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Main Workspace -->
    <div class="flex-1 flex overflow-hidden min-h-0">

      <!-- List Area -->
      <div class="flex-1 h-full overflow-y-auto px-2 pb-4 sm:px-4 custom-scrollbar bg-transparent">
        <div class="max-w-4xl mx-auto">

          <!-- Loading: shaped like the rows it is standing in for -->
          <div v-if="isLoading" class="space-y-1 pt-3">
            <div v-for="i in 8" :key="i" class="flex items-center gap-3 px-2 py-2.5">
              <div class="h-10 w-10 shrink-0 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
              <div class="flex-1 space-y-2">
                <div class="h-3.5 w-1/3 rounded bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
                <div class="h-3 w-1/2 rounded bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
              </div>
            </div>
          </div>

          <!-- Nothing matches the search or filter -->
          <div v-else-if="filteredLinks.length === 0 && hasFilters" class="flex flex-col items-center justify-center py-24 px-6 text-center">
            <SearchX class="h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p class="mt-3 text-sm font-semibold text-gray-900 dark:text-white">No links match</p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Nothing here for
              <span v-if="searchQuery.trim()" class="font-medium">"{{ searchQuery.trim() }}"</span>
              <span v-if="searchQuery.trim() && selectedCategory !== 'All'"> in </span>
              <span v-if="selectedCategory !== 'All'" class="font-medium">{{ selectedCategory }}</span>.
            </p>
            <button
              @click="clearFilters"
              class="mt-4 rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Clear filters
            </button>
          </div>

          <!-- Nothing saved yet -->
          <div v-else-if="filteredLinks.length === 0" class="flex flex-col items-center justify-center py-24 px-6 text-center">
            <Link2 class="h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p class="mt-3 text-sm font-semibold text-gray-900 dark:text-white">No links yet</p>
            <p class="mt-1 max-w-xs text-sm text-gray-500 dark:text-gray-400">
              Keep the pages the church uses often — livestreams, forms, song sheets — where everyone can find them.
            </p>
            <button
              v-if="canManage('links')"
              @click="handleAdd"
              class="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition-colors"
            >
              <Plus class="h-4 w-4" /> Add the first link
            </button>
          </div>

          <!-- Links, grouped by category -->
          <div v-else>
            <section v-for="group in groupedLinks" :key="group.category">
              <div class="sticky top-0 z-10 flex items-center gap-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur py-2">
                <span :class="['rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider', categoryStyle(group.category)]">
                  {{ group.category }}
                </span>
                <span class="text-xs font-medium text-gray-400 dark:text-gray-500">{{ group.items.length }}</span>
              </div>

              <div
                v-for="link in group.items"
                :key="link.id"
                class="group flex items-center rounded-xl transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
              >
                <!-- A real anchor, so the row can be opened in a new tab, shared
                     from a long press, and reached with a keyboard. -->
                <a
                  :href="normalizeUrl(link.url)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2.5 sm:px-3"
                >
                  <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-900">
                    <img
                      v-if="faviconUrl(link.url) && !faviconErrors[link.id]"
                      :src="faviconUrl(link.url)"
                      alt=""
                      loading="lazy"
                      class="h-5 w-5 rounded-sm"
                      @error="faviconErrors[link.id] = true"
                    />
                    <component v-else :is="getIcon(link.url, link.category)" class="h-5 w-5" />
                  </span>

                  <span class="min-w-0 flex-1">
                    <span class="flex items-center gap-1.5">
                      <span class="truncate text-sm font-semibold text-gray-900 dark:text-white">{{ link.title }}</span>
                      <ExternalLink class="hidden h-3 w-3 shrink-0 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 sm:block" />
                    </span>
                    <span class="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
                      {{ link.description || hostLabel(link.url) }}
                    </span>
                  </span>
                </a>

                <button
                  @click.stop="openActions(link)"
                  class="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-white"
                  :aria-label="`Actions for ${link.title}`"
                >
                  <Check v-if="copiedId === link.id" class="h-4 w-4 text-emerald-500" />
                  <MoreHorizontal v-else class="h-4 w-4" />
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>

      <!-- Add/Edit form: a side panel on desktop, a sheet on a phone -->
      <Teleport to="body" :disabled="!isMobile">
      <Transition :name="isMobile ? 'modal-sheet' : 'panel'">
        <div v-if="showForm"
          :class="[
            isMobile
              ? 'fixed inset-0 z-80 flex flex-col justify-end'
              : 'link-form-panel m-3 rounded-2xl border-2 border-primary/30 dark:border-primary-light/30 bg-white dark:bg-gray-800 w-[calc(40%-1rem)] h-[calc(100%-1.5rem)] flex flex-col shrink-0 shadow-xl shadow-primary/25 dark:shadow-primary-light/20 relative overflow-hidden z-60'
          ]"
        >
          <div
            v-if="isMobile"
            class="absolute inset-0 bg-black/50"
            @click="showForm = false"
          />
          <div
            ref="formDialogRef"
            role="dialog"
            aria-modal="true"
            aria-labelledby="link-form-drawer-title"
            tabindex="-1"
            :class="[
              'flex flex-col min-h-0',
              isMobile
                ? 'relative z-10 w-full max-h-[92dvh] rounded-t-2xl bg-white dark:bg-gray-800 shadow-2xl border-t border-gray-200 dark:border-gray-700'
                : 'h-full w-full'
            ]"
          >
            <div class="shrink-0 rounded-t-2xl border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
              <div class="min-w-0">
                <h3 id="link-form-drawer-title" class="text-base font-semibold text-gray-900 dark:text-white">
                  {{ isEditing ? 'Edit link' : 'Add link' }}
                </h3>
                <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Everyone signed in can see it</p>
              </div>
              <button
                @click="showForm = false"
                aria-label="Close"
                class="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X class="h-5 w-5" />
              </button>
            </div>

            <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 custom-scrollbar">
              <div class="space-y-1.5">
                <label for="link-title" class="text-xs font-semibold text-gray-500 dark:text-gray-400">Title</label>
                <input
                  id="link-title"
                  v-model="form.title"
                  type="text"
                  placeholder="e.g. Sunday livestream"
                  class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-transparent focus:ring-2 focus:ring-primary"
                />
              </div>

              <div class="space-y-1.5">
                <label for="link-url" class="text-xs font-semibold text-gray-500 dark:text-gray-400">Link</label>
                <input
                  id="link-url"
                  v-model="form.url"
                  type="url"
                  inputmode="url"
                  placeholder="Paste or type an address"
                  class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-transparent focus:ring-2 focus:ring-primary"
                />
                <!-- Reads back the host, so a mistyped address shows itself here
                     instead of on Sunday morning. -->
                <p v-if="form.url && isOpenableUrl(form.url)" class="flex items-center gap-1.5 pt-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                  <component :is="getIcon(form.url, form.category)" class="h-3.5 w-3.5 shrink-0" />
                  Goes to {{ hostLabel(form.url) }}
                </p>
                <p v-else-if="form.url" class="flex items-center gap-1.5 pt-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <AlertTriangle class="h-3.5 w-3.5 shrink-0" />
                  That does not look like a web address yet
                </p>
              </div>

              <div class="space-y-1.5">
                <p class="text-xs font-semibold text-gray-500 dark:text-gray-400">Category</p>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    v-for="cat in categories.slice(1)"
                    :key="cat"
                    @click="form.category = cat"
                    :class="[
                      'rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors',
                      form.category === cat
                        ? 'border-primary bg-primary text-white'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-primary/40'
                    ]"
                  >
                    {{ cat }}
                  </button>
                </div>
              </div>

              <div class="space-y-1.5">
                <label for="link-notes" class="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Description <span class="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  id="link-notes"
                  v-model="form.description"
                  rows="3"
                  placeholder="What it is for, or who needs it"
                  class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-transparent focus:ring-2 focus:ring-primary"
                ></textarea>
                <p class="text-xs text-gray-400">Shown under the title in the list.</p>
              </div>
            </div>

            <div class="shrink-0 rounded-b-2xl border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
              <button
                @click="handleSubmit"
                :disabled="isSubmitting || !canSubmit"
                class="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                <Loader2 v-if="isSubmitting" class="h-4 w-4 animate-spin" />
                <span>{{ isEditing ? 'Save changes' : 'Add link' }}</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
      </Teleport>
    </div>

    <!-- Row actions -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="actionsFor" class="fixed inset-0 z-90 flex flex-col justify-end sm:items-center sm:justify-center">
          <div class="absolute inset-0 bg-black/50" @click="closeActions" />

          <div
            ref="actionsSheetRef"
            role="dialog"
            aria-modal="true"
            aria-labelledby="link-actions-title"
            tabindex="-1"
            class="actions-sheet relative z-10 w-full sm:max-w-sm flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border-t sm:border border-gray-200 dark:border-gray-700"
          >
            <div class="flex items-center gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-700">
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-900">
                <img
                  v-if="faviconUrl(actionsFor.url) && !faviconErrors[actionsFor.id]"
                  :src="faviconUrl(actionsFor.url)"
                  alt=""
                  class="h-5 w-5 rounded-sm"
                  @error="faviconErrors[actionsFor.id] = true"
                />
                <component v-else :is="getIcon(actionsFor.url, actionsFor.category)" class="h-5 w-5" />
              </span>
              <div class="min-w-0">
                <h3 id="link-actions-title" class="truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {{ actionsFor.title }}
                </h3>
                <p class="truncate text-xs text-gray-500 dark:text-gray-400">{{ hostLabel(actionsFor.url) }}</p>
              </div>
            </div>

            <div class="p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:pb-2">
              <a
                :href="normalizeUrl(actionsFor.url)"
                target="_blank"
                rel="noopener noreferrer"
                @click="closeActions"
                class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
              >
                <ExternalLink class="h-4 w-4 shrink-0 text-gray-400" /> Open link
              </a>
              <button
                @click="copyLink(actionsFor)"
                class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
              >
                <Copy class="h-4 w-4 shrink-0 text-gray-400" /> Copy link
              </button>
              <template v-if="canManage('links')">
                <div class="my-1 h-px bg-gray-100 dark:bg-gray-700"></div>
                <button
                  @click="handleEdit(actionsFor)"
                  class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
                >
                  <Pencil class="h-4 w-4 shrink-0 text-gray-400" /> Edit
                </button>
                <button
                  @click="askDelete(actionsFor)"
                  class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 class="h-4 w-4 shrink-0" /> Delete
                </button>
              </template>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <ConfirmationModal
      :show="showConfirmation"
      title="Delete link"
      :message="`Remove &quot;${linkToDelete?.title}&quot; from the links page? This cannot be undone.`"
      confirm-text="Delete"
      cancel-text="Cancel"
      confirm-button-class="bg-red-600 text-white hover:bg-red-700"
      @update:show="showConfirmation = $event"
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* The backdrop fades while the sheet itself slides up from the edge. */
.fade-enter-active .actions-sheet,
.fade-leave-active .actions-sheet {
  transition: transform 0.25s ease;
}
.fade-enter-from .actions-sheet,
.fade-leave-to .actions-sheet {
  transform: translateY(100%);
}
@media (min-width: 640px) {
  .fade-enter-from .actions-sheet,
  .fade-leave-to .actions-sheet {
    transform: scale(0.96);
  }
}

.link-form-panel {
  transition: max-width 0.3s ease-out, opacity 0.3s ease;
}

.panel-enter-from,
.panel-leave-to {
  max-width: 0 !important;
  opacity: 0;
  margin-left: 0 !important;
  margin-right: 0 !important;
}

.modal-sheet-enter-active,
.modal-sheet-leave-active {
  transition: opacity 0.25s ease;
}

.modal-sheet-enter-active > div:last-child,
.modal-sheet-leave-active > div:last-child {
  transition: transform 0.25s ease;
}

.modal-sheet-enter-from,
.modal-sheet-leave-to {
  opacity: 0;
}

.modal-sheet-enter-from > div:last-child,
.modal-sheet-leave-to > div:last-child {
  transform: translateY(100%);
}
</style>
