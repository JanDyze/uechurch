<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  ListMusic,
  Plus,
  X,
  MoreHorizontal,
  ExternalLink,
  Trash2,
  Pencil,
  Copy,
  Check,
  Youtube,
  Play,
  AlertTriangle,
  Loader2,
  ListFilter,
  SearchX,
  FileText
} from '../icons'
import { subscribeToSongs, addSong, updateSong, deleteSong } from '../api/songsService'
import { searchYoutube } from '../api/youtubeSearchService'
import { useMediaQuery } from '../composables/useMediaQuery'
import { useFocusTrap } from '../composables/useFocusTrap'
import { useMembers } from '../composables/useMembers'
import { useToast } from '../composables/useToast'
import { getFullName } from '../utils/memberUtils'
import { copyText } from '../utils/clipboard'
import { normalizeUrl, hostLabel } from '../utils/linkUtils'
import { categoryStyle } from '../utils/categoryStyle'
import {
  getYoutubeId,
  getYoutubeThumbnail,
  hasLyrics,
  songLyricsText,
  parseLyricSections,
  tidyLyrics
} from '../utils/songUtils'
import SearchBar from '../components/common/SearchBar.vue'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'
import SongPlayer from '../components/songs/SongPlayer.vue'
import { usePermissions } from '../composables/usePermissions'
import { useAppSettings } from '../composables/useAppSettings'
import { withAllOption } from '../data/appDefaults'

const { canManage } = usePermissions()
const toast = useToast()
const router = useRouter()

/** The full-screen editor. The drawer is for checking a key or a link; typing
 *  out forty lines of lyrics wants the whole page. */
const openSongEditor = (song) => {
  if (!song) return
  router.push(`/songs/${song.id}`)
}

const isMobile = useMediaQuery('(max-width: 1023px)')

// Members tagged "Song Leader" (any casing), offered as the leader picker
const { members } = useMembers()
const songLeaders = computed(() => {
  return members.value.filter((m) => (m.tags || []).some((t) => t.toLowerCase() === 'song leader'))
})

// State
const searchQuery = ref('')
const mobileSearchOpen = ref(false)
const selectedCategory = ref('All')
const songs = ref([])
const isLoading = ref(true)
const showFilterDropdown = ref(false)
const showForm = ref(false)
const isEditing = ref(false)
const isSubmitting = ref(false)
const copiedId = ref(null)
const lyricsCopiedId = ref(null)
// Thumbnails come from YouTube and are the first thing to fail offline, so
// every failure is remembered and the row falls back to a drawn icon.
const thumbnailErrors = ref({})
const showSongDetails = ref(false)
const selectedSongDetails = ref(null)

// Searching YouTube from the same box, so a song the list has never had can be
// found and added without a trip to the YouTube app and back with a pasted
// link. Deliberately on a tap rather than on every keystroke: each search
// spends from a daily quota the whole church shares.
const youtubeResults = ref([])
const youtubeQuery = ref('')
const isSearchingYoutube = ref(false)

// One row's actions, in a sheet rather than a popover: the list scrolls, and an
// absolutely positioned menu on the last row was being clipped by it.
const actionsFor = ref(null)

// Delete confirmation
const showConfirmation = ref(false)
const songToDelete = ref(null)

// Form state
const initialForm = {
  title: '',
  youtubeUrl: '',
  category: 'Praise',
  // Kept verbatim, line breaks and all: the tech team copies this straight
  // into the projector slides, where a line break is a slide break.
  lyrics: '',
  notes: ''
}
const form = ref({ ...initialForm })

// Tidying pasted lyrics: whitespace and headings only, applied on save (see
// handleSubmit). It is local, instant and free, so it does not need a button —
// nobody wants to press one to have trailing spaces removed.
//
// Deciding which words address God is the half that needs judgement, and it
// has moved to the "Identify sections" pass on the song page: it is the same
// read of the same song, and doing it there means one look at the result
// instead of two.

// One key per song leader (e.g. { [memberId]: 'G' }), since different
// leaders sing/play the same song in different keys. Every current song
// leader gets an entry (defaulting to '') so the field stays reactive and
// never saves `undefined`, which Firestore rejects.
const buildLeaderKeys = (existing = {}) => {
  const map = {}
  songLeaders.value.forEach((leader) => {
    map[leader.id] = existing[leader.id] || ''
  })
  return map
}

// Categories
const { categories: appCategories } = useAppSettings()
const categories = computed(() => withAllOption(appCategories.value.songs))

// Subscription
let unsubscribeSongs = null

onMounted(() => {
  isLoading.value = true
  unsubscribeSongs = subscribeToSongs((data) => {
    songs.value = data
    isLoading.value = false
  })
  window.addEventListener('click', closeMenus)
})

onUnmounted(() => {
  if (unsubscribeSongs) unsubscribeSongs()
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

const filteredSongs = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return songs.value.filter((song) => {
    if (selectedCategory.value !== 'All' && song.category !== selectedCategory.value) return false
    if (!query) return true
    // The lyrics are searched too: half the time nobody remembers the title,
    // only the line that keeps going round in their head.
    const fields = [song.title, song.notes, song.lyrics, song.category]
    if (fields.some((field) => String(field || '').toLowerCase().includes(query))) return true
    return Object.values(song.leaderKeys || {}).some((key) =>
      String(key || '').toLowerCase().includes(query)
    )
  })
})

// Grouped by category, in the order an administrator arranged them in Settings.
// The headings do the work the old per-row category pill was doing, and leave
// the row itself to the title and who sings it in which key.
const groupedSongs = computed(() => {
  const order = appCategories.value.songs || []
  const buckets = new Map()
  filteredSongs.value.forEach((song) => {
    const key = song.category || 'Uncategorised'
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(song)
  })
  const rank = (name) => {
    const index = order.indexOf(name)
    return index === -1 ? order.length : index
  }
  return [...buckets.entries()]
    .map(([category, items]) => ({ category, items }))
    .sort((a, b) => rank(a.category) - rank(b.category) || a.category.localeCompare(b.category))
})

// Which videos are already saved, so a search result can say so instead of
// offering to add a second copy of a song that is already here.
const savedByVideoId = computed(() => {
  const map = new Map()
  songs.value.forEach((song) => {
    const id = getYoutubeId(song.youtubeUrl)
    if (id) map.set(id, song)
  })
  return map
})

// The results answer the words that were in the box when the button was
// pressed; once those change they are answering the wrong question.
watch(searchQuery, (value) => {
  if (value.trim() !== youtubeQuery.value) {
    youtubeResults.value = []
    youtubeQuery.value = ''
  }
})

const runYoutubeSearch = async () => {
  const query = searchQuery.value.trim()
  if (!query || isSearchingYoutube.value) return
  isSearchingYoutube.value = true
  try {
    const results = await searchYoutube(query)
    youtubeResults.value = results
    youtubeQuery.value = query
  } catch (error) {
    console.error('YouTube search failed:', error)
    youtubeResults.value = []
    youtubeQuery.value = ''
    toast.error(error.message || 'Could not reach YouTube. Try again.')
  } finally {
    isSearchingYoutube.value = false
  }
}

const getThumbnail = (url) => getYoutubeThumbnail(url)

const detailsVideoId = computed(() => getYoutubeId(selectedSongDetails.value?.youtubeUrl))
const detailsLyrics = computed(() => songLyricsText(selectedSongDetails.value))

// The same lyrics read as verse/chorus/bridge. Nothing is rewritten — this is
// only a view of the stored text, which stays verbatim because the tech team
// copies it straight into the projector slides.
const detailsSections = computed(() => parseLyricSections(selectedSongDetails.value))

const getLeaderKeyEntries = (song) => {
  const map = song?.leaderKeys || {}
  return Object.entries(map)
    .filter(([, key]) => key && key.trim())
    .map(([memberId, key]) => {
      const member = members.value.find((m) => String(m.id) === String(memberId) || String(m.firestoreId) === String(memberId))
      return { name: member ? getFullName(member) : 'Unknown', key }
    })
}

const getLeaderKeySummary = (song) => {
  return getLeaderKeyEntries(song).map((entry) => `${entry.name}: ${entry.key}`).join(', ')
}

// The one line under the title: the keys if anyone has set one, because that is
// what the worship team is looking for, and something honest to read otherwise.
const songSubtitle = (song) =>
  getLeaderKeySummary(song) || song.notes || hostLabel(song.youtubeUrl)

const openActions = (song) => {
  actionsFor.value = song
}

const closeActions = () => {
  actionsFor.value = null
}

const actionsSheetRef = ref(null)
useFocusTrap(actionsSheetRef, computed(() => actionsFor.value !== null), closeActions)

const formDialogRef = ref(null)
useFocusTrap(formDialogRef, showForm, () => { showForm.value = false })

const songDetailsRef = ref(null)
useFocusTrap(songDetailsRef, showSongDetails, () => { showSongDetails.value = false })

const openSongDetails = (song) => {
  showForm.value = false
  selectedSongDetails.value = song
  showSongDetails.value = true
}

const handleAdd = () => {
  showSongDetails.value = false
  form.value = {
    ...initialForm,
    category: appCategories.value.songs?.[0] || initialForm.category,
    leaderKeys: buildLeaderKeys()
  }
  isEditing.value = false
  showForm.value = true
}

// A YouTube result becomes a draft song rather than a saved one: the title and
// the link are all YouTube can tell us, and the category and the keys are the
// part only the worship team knows.
const addFromYoutube = (result) => {
  const existing = savedByVideoId.value.get(result.videoId)
  if (existing) {
    openSongDetails(existing)
    return
  }
  showSongDetails.value = false
  form.value = {
    ...initialForm,
    category: appCategories.value.songs?.[0] || initialForm.category,
    title: result.title,
    youtubeUrl: result.url,
    leaderKeys: buildLeaderKeys()
  }
  isEditing.value = false
  showForm.value = true
}

const handleEdit = (song) => {
  showSongDetails.value = false
  closeActions()
  form.value = { ...initialForm, ...song, leaderKeys: buildLeaderKeys(song.leaderKeys || {}) }
  isEditing.value = true
  showForm.value = true
}

const canSubmit = computed(
  () => form.value.title.trim().length > 0 && String(form.value.youtubeUrl || '').trim().length > 0
)

const handleSubmit = async () => {
  if (!canSubmit.value || isSubmitting.value) return
  isSubmitting.value = true
  const payload = {
    title: form.value.title.trim(),
    // Stored ready to open: someone typing "youtube.com/..." into the field
    // would otherwise be saving a link the browser reads as a path on this site.
    youtubeUrl: normalizeUrl(form.value.youtubeUrl),
    category: form.value.category,
    leaderKeys: form.value.leaderKeys,
    // Trailing spaces, runs of blank lines and a heading typed "KORO" one week
    // and "koro" the next: none of it is the song, all of it shows on screen.
    // Line breaks inside the lyrics are left exactly as typed — they are slide
    // breaks to whoever builds the deck.
    lyrics: tidyLyrics(form.value.lyrics),
    notes: (form.value.notes || '').trim()
  }
  try {
    if (isEditing.value) {
      await updateSong(form.value.id, payload)
      toast.success('Song updated')
    } else {
      await addSong(payload)
      toast.success('Song added')
    }
    showForm.value = false
  } catch (error) {
    console.error('Error saving song:', error)
    toast.error('Could not save that song. Please try again.')
  } finally {
    isSubmitting.value = false
  }
}

const askDelete = (song) => {
  songToDelete.value = song
  closeActions()
  showConfirmation.value = true
}

const confirmDelete = async () => {
  const song = songToDelete.value
  if (!song) return
  try {
    await deleteSong(song.id)
    if (selectedSongDetails.value?.id === song.id) showSongDetails.value = false
    toast.success('Song deleted')
  } catch (error) {
    console.error('Error deleting song:', error)
    toast.error('Could not delete that song. Please try again.')
  }
  // Deliberately left set: the modal names the song while it fades out, and the
  // next delete overwrites it anyway.
}

const copyLink = async (song) => {
  if (await copyText(normalizeUrl(song.youtubeUrl))) {
    copiedId.value = song.id
    setTimeout(() => {
      if (copiedId.value === song.id) copiedId.value = null
    }, 2000)
    toast.success('Link copied')
  } else {
    toast.error('Could not copy the link.')
  }
  closeActions()
}

/** The lyrics alone, exactly as stored — nothing to trim out before it goes
 *  into the projector software. */
const copyLyrics = async (song) => {
  const lyrics = songLyricsText(song)
  if (!lyrics) {
    toast.warning('No lyrics saved for this song yet.')
    return
  }
  if (!(await copyText(lyrics))) {
    toast.error('Could not copy the lyrics.')
    return
  }
  lyricsCopiedId.value = song.id
  setTimeout(() => {
    if (lyricsCopiedId.value === song.id) lyricsCopiedId.value = null
  }, 2000)
  toast.success(`Lyrics copied — ${song.title}`)
  closeActions()
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden bg-transparent">

    <!-- Action Bar -->
    <div class="sticky top-0 z-40 mb-2 shrink-0 rounded-xl border border-gray-200/80 bg-white/95 px-2 py-2 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 sm:px-3">
      <div class="flex items-center justify-between gap-2 w-full flex-nowrap">
        <SearchBar v-model="searchQuery" v-model:open="mobileSearchOpen" placeholder="Search songs..." />

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
            v-if="canManage('songs')"
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
              <div class="h-10 w-18 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
              <div class="flex-1 space-y-2">
                <div class="h-3.5 w-1/3 rounded bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
                <div class="h-3 w-1/2 rounded bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
              </div>
            </div>
          </div>

          <!-- Nothing matches the search or filter -->
          <div v-else-if="filteredSongs.length === 0 && hasFilters" class="flex flex-col items-center justify-center px-6 py-12 text-center">
            <SearchX class="h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p class="mt-3 text-sm font-semibold text-gray-900 dark:text-white">No songs match</p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Nothing here for
              <span v-if="searchQuery.trim()" class="font-medium">"{{ searchQuery.trim() }}"</span>
              <span v-if="searchQuery.trim() && selectedCategory !== 'All'"> in </span>
              <span v-if="selectedCategory !== 'All'" class="font-medium">{{ selectedCategory }}</span>.
            </p>

            <!-- The songbook not having it is the usual reason to reach for
                 YouTube, so the two moves sit together: look it up, or widen
                 the search back out. Listed first because it is the one more
                 often wanted — the song exists, it just is not saved yet. -->
            <div class="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                v-if="canManage('songs') && searchQuery.trim() && youtubeQuery !== searchQuery.trim()"
                @click="runYoutubeSearch"
                :disabled="isSearchingYoutube"
                class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
              >
                <Loader2 v-if="isSearchingYoutube" class="h-4 w-4 animate-spin" />
                <Youtube v-else class="h-4 w-4" />
                {{ isSearchingYoutube ? 'Searching YouTube…' : 'Search YouTube' }}
              </button>
              <button
                @click="clearFilters"
                class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                Clear filters
              </button>
            </div>
          </div>

          <!-- Nothing saved yet -->
          <div v-else-if="filteredSongs.length === 0" class="flex flex-col items-center justify-center py-24 px-6 text-center">
            <ListMusic class="h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p class="mt-3 text-sm font-semibold text-gray-900 dark:text-white">No songs yet</p>
            <p class="mt-1 max-w-xs text-sm text-gray-500 dark:text-gray-400">
              Build the songbook the worship team sings from — the recording, the key each leader takes it in, and the lyrics for the slides.
            </p>
            <button
              v-if="canManage('songs')"
              @click="handleAdd"
              class="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition-colors"
            >
              <Plus class="h-4 w-4" /> Add the first song
            </button>
          </div>

          <!-- Songs, grouped by category -->
          <div v-else>
            <section v-for="group in groupedSongs" :key="group.category">
              <div class="sticky top-0 z-10 flex items-center gap-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur py-2">
                <span :class="['rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider', categoryStyle(group.category)]">
                  {{ group.category }}
                </span>
                <span class="text-xs font-medium text-gray-400 dark:text-gray-500">{{ group.items.length }}</span>
              </div>

              <div
                v-for="song in group.items"
                :key="song.id"
                class="group flex items-center rounded-xl transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
                @contextmenu.prevent="openActions(song)"
              >
                <button
                  type="button"
                  @click="openSongDetails(song)"
                  class="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2.5 text-left sm:px-3"
                >
                  <span class="relative flex h-10 w-18 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-900">
                    <template v-if="getThumbnail(song.youtubeUrl) && !thumbnailErrors[song.id]">
                      <img
                        :src="getThumbnail(song.youtubeUrl)"
                        alt=""
                        loading="lazy"
                        class="h-full w-full object-cover"
                        @error="thumbnailErrors[song.id] = true"
                      />
                      <span class="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/30">
                        <span class="flex h-5 w-5 items-center justify-center rounded-full bg-black/50">
                          <Play class="h-2.5 w-2.5 text-white" />
                        </span>
                      </span>
                    </template>
                    <Youtube v-else class="h-5 w-5 text-red-500" />
                  </span>

                  <span class="min-w-0 flex-1">
                    <span class="flex items-center gap-1.5">
                      <span class="truncate text-sm font-semibold text-gray-900 dark:text-white">{{ song.title }}</span>
                      <FileText
                        v-if="hasLyrics(song)"
                        class="h-3.5 w-3.5 shrink-0 text-emerald-500"
                        aria-label="Lyrics saved"
                      />
                    </span>
                    <span class="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
                      {{ songSubtitle(song) }}
                    </span>
                  </span>
                </button>

                <button
                  @click.stop="openActions(song)"
                  class="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-white"
                  :aria-label="`Actions for ${song.title}`"
                >
                  <Check v-if="copiedId === song.id" class="h-4 w-4 text-emerald-500" />
                  <MoreHorizontal v-else class="h-4 w-4" />
                </button>
              </div>
            </section>
          </div>

          <!-- Not in the list? The same words, looked up on YouTube, and added
               from the result without leaving the page. -->
          <div v-if="!isLoading && canManage('songs') && searchQuery.trim()" class="pt-2">
            <button
              v-if="youtubeQuery !== searchQuery.trim() && filteredSongs.length > 0"
              @click="runYoutubeSearch"
              :disabled="isSearchingYoutube"
              class="flex w-full items-center gap-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-2 py-2.5 text-left transition-colors hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-60 sm:px-3"
            >
              <span class="flex h-10 w-18 shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                <Loader2 v-if="isSearchingYoutube" class="h-4 w-4 animate-spin text-gray-400" />
                <Youtube v-else class="h-5 w-5 text-red-500" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {{ isSearchingYoutube ? 'Searching YouTube…' : 'Search YouTube' }}
                </span>
                <span class="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
                  for "{{ searchQuery.trim() }}"
                </span>
              </span>
            </button>

            <section v-else-if="youtubeQuery === searchQuery.trim()">
              <div class="sticky top-0 z-10 flex items-center gap-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur py-2">
                <span class="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-red-600 dark:bg-red-500/10 dark:text-red-400">
                  <Youtube class="h-3 w-3" /> From YouTube
                </span>
                <span class="text-xs font-medium text-gray-400 dark:text-gray-500">{{ youtubeResults.length }}</span>
              </div>

              <p v-if="youtubeResults.length === 0" class="px-2 py-3 text-sm text-gray-500 dark:text-gray-400 sm:px-3">
                Nothing on YouTube for "{{ youtubeQuery }}".
              </p>

              <div
                v-for="result in youtubeResults"
                :key="result.videoId"
                class="group flex items-center rounded-xl transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
              >
                <button
                  type="button"
                  @click="addFromYoutube(result)"
                  class="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2.5 text-left sm:px-3"
                >
                  <span class="relative flex h-10 w-18 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                    <img
                      v-if="result.thumbnail"
                      :src="result.thumbnail"
                      alt=""
                      loading="lazy"
                      class="h-full w-full object-cover"
                    />
                    <Youtube v-else class="h-5 w-5 text-red-500" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-semibold text-gray-900 dark:text-white">{{ result.title }}</span>
                    <span class="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">{{ result.channelTitle }}</span>
                  </span>
                </button>

                <span
                  v-if="savedByVideoId.has(result.videoId)"
                  class="mr-2 inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                >
                  <Check class="h-3 w-3" /> In list
                </span>
                <button
                  v-else
                  @click.stop="addFromYoutube(result)"
                  class="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-primary dark:hover:bg-gray-700 dark:hover:text-white"
                  :aria-label="`Add ${result.title}`"
                >
                  <Plus class="h-4 w-4" />
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
              : 'song-form-panel m-3 rounded-2xl border-2 border-primary/30 dark:border-primary-light/30 bg-white dark:bg-gray-800 w-[calc(50%-1rem)] h-[calc(100%-1.5rem)] flex flex-col shrink-0 shadow-xl shadow-primary/25 dark:shadow-primary-light/20 relative overflow-hidden z-60'
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
            aria-labelledby="song-form-drawer-title"
            tabindex="-1"
            :class="[
              'flex flex-col min-h-0',
              isMobile
                ? 'relative z-10 w-full max-h-[92dvh] rounded-t-2xl bg-white dark:bg-gray-800 shadow-2xl border-t border-gray-200 dark:border-gray-700'
                : 'h-full w-full'
            ]"
          >
            <div class="shrink-0 rounded-t-2xl bg-linear-to-r from-primary/10 to-transparent dark:from-primary-light/10 dark:to-transparent border-b border-primary/20 dark:border-primary-light/20 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
              <div class="min-w-0">
                <h3 id="song-form-drawer-title" class="text-base font-semibold text-gray-900 dark:text-white">
                  {{ isEditing ? 'Edit song' : 'Add song' }}
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
                <label for="song-title" class="text-xs font-semibold text-gray-500 dark:text-gray-400">Title</label>
                <input
                  id="song-title"
                  v-model="form.title"
                  type="text"
                  placeholder="e.g. Way Maker"
                  class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-transparent focus:ring-2 focus:ring-primary"
                />
              </div>

              <div class="space-y-1.5">
                <label for="song-url" class="text-xs font-semibold text-gray-500 dark:text-gray-400">YouTube link</label>
                <input
                  id="song-url"
                  v-model="form.youtubeUrl"
                  type="url"
                  inputmode="url"
                  placeholder="Paste the video address"
                  class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-transparent focus:ring-2 focus:ring-primary"
                />
                <!-- Reads back what was recognised, so a mistyped address shows
                     itself here instead of on Sunday morning. -->
                <p v-if="form.youtubeUrl && getYoutubeId(form.youtubeUrl)" class="flex items-center gap-1.5 pt-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                  <Youtube class="h-3.5 w-3.5 shrink-0" />
                  Plays here in the app
                </p>
                <p v-else-if="form.youtubeUrl" class="flex items-center gap-1.5 pt-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <AlertTriangle class="h-3.5 w-3.5 shrink-0" />
                  Not a YouTube video, so it will only open in a new tab
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
                <p class="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Keys <span class="font-normal text-gray-400">(optional)</span>
                </p>
                <div v-if="songLeaders.length > 0" class="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                  <div v-for="leader in songLeaders" :key="leader.id" class="flex items-center gap-3 px-3 py-2">
                    <label :for="`song-key-${leader.id}`" class="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-300">
                      {{ getFullName(leader) }}
                    </label>
                    <input
                      :id="`song-key-${leader.id}`"
                      v-model="form.leaderKeys[leader.id]"
                      type="text"
                      placeholder="G"
                      class="w-16 shrink-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-center text-sm font-semibold text-gray-900 dark:text-white outline-none focus:border-transparent focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                <p v-else class="text-xs text-gray-400">
                  Nobody is tagged "Song Leader" yet — add the tag on the People page and their key will appear here.
                </p>
              </div>

              <div class="space-y-1.5">
                <label for="song-lyrics" class="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Lyrics <span class="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  id="song-lyrics"
                  v-model="form.lyrics"
                  rows="10"
                  spellcheck="false"
                  placeholder="Paste the lyrics here."
                  class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm leading-relaxed text-gray-900 dark:text-white outline-none focus:border-transparent focus:ring-2 focus:ring-primary"
                ></textarea>
                <p class="text-xs text-gray-400">
                  Copied straight into the projector slides, so the line breaks you type are the line breaks they get.
                  Spacing and headings are tidied when you save; open the song to identify its sections and capitalise the words addressing God.
                </p>
              </div>

              <div class="space-y-1.5">
                <label for="song-notes" class="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Notes <span class="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  id="song-notes"
                  v-model="form.notes"
                  rows="3"
                  placeholder="Arrangement, transitions, who leads it"
                  class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-transparent focus:ring-2 focus:ring-primary"
                ></textarea>
              </div>
            </div>

            <div class="shrink-0 rounded-b-2xl bg-linear-to-r from-primary/10 to-transparent dark:from-primary-light/10 dark:to-transparent border-t border-primary/20 dark:border-primary-light/20 px-4 sm:px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
              <button
                @click="handleSubmit"
                :disabled="isSubmitting || !canSubmit"
                class="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                <Loader2 v-if="isSubmitting" class="h-4 w-4 animate-spin" />
                <span>{{ isEditing ? 'Save changes' : 'Add song' }}</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
      </Teleport>

      <!-- Song details: the same placement as the form, a sheet on a phone -->
      <Teleport to="body" :disabled="!isMobile">
      <Transition :name="isMobile ? 'modal-sheet' : 'panel'">
        <div v-if="showSongDetails && selectedSongDetails"
          :class="[
            isMobile
              ? 'fixed inset-0 z-80 flex flex-col justify-end'
              : 'song-view-panel m-3 rounded-2xl border-2 border-primary/30 dark:border-primary-light/30 bg-white dark:bg-gray-800 w-[calc(50%-1rem)] h-[calc(100%-1.5rem)] flex flex-col shrink-0 shadow-xl shadow-primary/25 dark:shadow-primary-light/20 relative overflow-hidden z-60'
          ]"
        >
          <div
            v-if="isMobile"
            class="absolute inset-0 bg-black/50"
            @click="showSongDetails = false"
          />
          <div
            ref="songDetailsRef"
            role="dialog"
            aria-modal="true"
            aria-labelledby="song-view-title"
            tabindex="-1"
            :class="[
              'flex flex-col min-h-0',
              isMobile
                ? 'relative z-10 w-full max-h-[92dvh] rounded-t-2xl bg-white dark:bg-gray-800 shadow-2xl border-t border-gray-200 dark:border-gray-700'
                : 'h-full w-full'
            ]"
          >
            <div class="shrink-0 rounded-t-2xl bg-linear-to-r from-primary/10 to-transparent dark:from-primary-light/10 dark:to-transparent border-b border-primary/20 dark:border-primary-light/20 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
              <div class="min-w-0">
                <h3 id="song-view-title" class="truncate text-base font-semibold text-gray-900 dark:text-white">
                  {{ selectedSongDetails.title }}
                </h3>
                <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ selectedSongDetails.category }}</p>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <button
                  @click="openSongEditor(selectedSongDetails)"
                  class="rounded-lg px-2.5 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/10"
                >
                  Open editor
                </button>
                <button
                  @click="showSongDetails = false"
                  aria-label="Close"
                  class="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X class="h-5 w-5" />
                </button>
              </div>
            </div>

            <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 custom-scrollbar">
              <SongPlayer
                v-if="detailsVideoId"
                :video-id="detailsVideoId"
                :title="selectedSongDetails.title"
              />
              <div v-else class="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 text-center">
                <Youtube class="h-8 w-8 text-red-500" />
                <p class="text-xs text-gray-500 dark:text-gray-400">This link isn't a YouTube video, so it can't play here.</p>
              </div>

              <div v-if="getLeaderKeyEntries(selectedSongDetails).length > 0" class="space-y-1.5">
                <p class="text-xs font-semibold text-gray-500 dark:text-gray-400">Keys</p>
                <div class="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                  <div
                    v-for="entry in getLeaderKeyEntries(selectedSongDetails)"
                    :key="entry.name"
                    class="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <span class="min-w-0 truncate text-sm text-gray-700 dark:text-gray-300">{{ entry.name }}</span>
                    <span class="shrink-0 text-sm font-semibold text-primary dark:text-primary-light">{{ entry.key }}</span>
                  </div>
                </div>
              </div>

              <!-- Lyrics: the tech team's copy-and-paste source for the slides -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs font-semibold text-gray-500 dark:text-gray-400">Lyrics</p>
                  <button
                    v-if="detailsLyrics"
                    @click="copyLyrics(selectedSongDetails)"
                    class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white transition-colors"
                  >
                    <Check v-if="lyricsCopiedId === selectedSongDetails.id" class="h-3.5 w-3.5 text-emerald-500" />
                    <Copy v-else class="h-3.5 w-3.5" />
                    {{ lyricsCopiedId === selectedSongDetails.id ? 'Copied' : 'Copy' }}
                  </button>
                </div>

                <div
                  v-if="detailsLyrics"
                  class="max-h-96 w-full space-y-4 overflow-y-auto custom-scrollbar rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 select-text"
                >
                  <section v-for="section in detailsSections" :key="section.id">
                    <p
                      v-if="section.label"
                      class="mb-1 text-[11px] font-bold uppercase tracking-wide text-primary dark:text-primary-light"
                    >
                      {{ section.label }}
                    </p>
                    <pre class="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-gray-700 dark:text-gray-200">{{ section.text }}</pre>
                  </section>
                </div>

                <p v-else class="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 p-3 text-sm text-gray-500 dark:text-gray-400">
                  No lyrics saved yet.
                  <button
                    v-if="canManage('songs')"
                    @click="handleEdit(selectedSongDetails)"
                    class="font-semibold text-primary dark:text-primary-light hover:underline"
                  >
                    Add them
                  </button>
                  <span v-else>Ask a worship lead to add them.</span>
                </p>
              </div>

              <div v-if="selectedSongDetails.notes" class="space-y-1.5">
                <p class="text-xs font-semibold text-gray-500 dark:text-gray-400">Notes</p>
                <p class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 text-sm text-gray-700 dark:text-gray-300">
                  {{ selectedSongDetails.notes }}
                </p>
              </div>

              <div class="space-y-1.5">
                <p class="text-xs font-semibold text-gray-500 dark:text-gray-400">Link</p>
                <a
                  :href="normalizeUrl(selectedSongDetails.youtubeUrl)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="block break-all text-sm text-primary dark:text-primary-light hover:underline"
                >
                  {{ selectedSongDetails.youtubeUrl }}
                </a>
              </div>
            </div>

            <div class="shrink-0 rounded-b-2xl bg-linear-to-r from-primary/10 to-transparent dark:from-primary-light/10 dark:to-transparent border-t border-primary/20 dark:border-primary-light/20 px-4 sm:px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
              <div class="flex items-center gap-2">
                <a
                  :href="normalizeUrl(selectedSongDetails.youtubeUrl)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
                >
                  <Youtube class="h-4 w-4" /> Watch on YouTube
                </a>
                <template v-if="canManage('songs')">
                  <button
                    @click="handleEdit(selectedSongDetails)"
                    aria-label="Edit song"
                    title="Edit"
                    class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 transition-colors hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    <Pencil class="h-5 w-5" />
                  </button>
                  <button
                    @click="askDelete(selectedSongDetails)"
                    aria-label="Delete song"
                    title="Delete"
                    class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 transition-colors hover:bg-red-100 dark:hover:bg-red-500/20"
                  >
                    <Trash2 class="h-5 w-5" />
                  </button>
                </template>
              </div>
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
            aria-labelledby="song-actions-title"
            tabindex="-1"
            class="actions-sheet relative z-10 w-full sm:max-w-sm flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border-t sm:border border-gray-200 dark:border-gray-700"
          >
            <div class="flex items-center gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-700">
              <span class="flex h-10 w-18 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-900">
                <img
                  v-if="getThumbnail(actionsFor.youtubeUrl) && !thumbnailErrors[actionsFor.id]"
                  :src="getThumbnail(actionsFor.youtubeUrl)"
                  alt=""
                  class="h-full w-full object-cover"
                  @error="thumbnailErrors[actionsFor.id] = true"
                />
                <Youtube v-else class="h-5 w-5 text-red-500" />
              </span>
              <div class="min-w-0">
                <h3 id="song-actions-title" class="truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {{ actionsFor.title }}
                </h3>
                <p class="truncate text-xs text-gray-500 dark:text-gray-400">{{ songSubtitle(actionsFor) }}</p>
              </div>
            </div>

            <div class="p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:pb-2">
              <button
                @click="openSongDetails(actionsFor); closeActions()"
                class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
              >
                <Play class="h-4 w-4 shrink-0 text-gray-400" /> Open song
              </button>
              <a
                :href="normalizeUrl(actionsFor.youtubeUrl)"
                target="_blank"
                rel="noopener noreferrer"
                @click="closeActions"
                class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
              >
                <ExternalLink class="h-4 w-4 shrink-0 text-gray-400" /> Watch on YouTube
              </a>
              <button
                @click="copyLink(actionsFor)"
                class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
              >
                <Copy class="h-4 w-4 shrink-0 text-gray-400" /> Copy link
              </button>
              <button
                v-if="hasLyrics(actionsFor)"
                @click="copyLyrics(actionsFor)"
                class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
              >
                <FileText class="h-4 w-4 shrink-0 text-emerald-500" /> Copy lyrics
              </button>
              <template v-if="canManage('songs')">
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
      title="Delete song"
      :message="`Remove &quot;${songToDelete?.title}&quot; from the song list? This cannot be undone.`"
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

.song-form-panel,
.song-view-panel {
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
