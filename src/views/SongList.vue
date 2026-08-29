<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  ListMusic,
  Plus,
  X,
  MoreHorizontal,
  ExternalLink,
  Trash2,
  Edit3,
  Copy,
  Check,
  Youtube,
  Play,
  AlertTriangle,
  Loader2,
  ListFilter,
  ArrowRight,
  FileText
} from 'lucide-vue-next'
import { subscribeToSongs, addSong, updateSong, deleteSong } from '../api/songsService'
import { useMediaQuery } from '../composables/useMediaQuery'
import { useFocusTrap } from '../composables/useFocusTrap'
import { useMembers } from '../composables/useMembers'
import { useToast } from '../composables/useToast'
import { getFullName } from '../utils/memberUtils'
import { copyText } from '../utils/clipboard'
import {
  getYoutubeId,
  getYoutubeThumbnail,
  hasLyrics,
  songLyricsText
} from '../utils/songUtils'
import SearchBar from '../components/common/SearchBar.vue'
import SongPlayer from '../components/songs/SongPlayer.vue'
import { usePermissions } from '../composables/usePermissions'
import { useAppSettings } from '../composables/useAppSettings'
import { withAllOption } from '../data/appDefaults'

const { canManage } = usePermissions()
const toast = useToast()

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
const showActions = ref(null) // ID of song with open actions menu
const showDeleteModal = ref(false)
const songToDelete = ref(null)
const showForm = ref(false)
const isEditing = ref(false)
const isSubmitting = ref(false)
const copySuccess = ref(null) // ID of song whose link was just copied
const lyricsCopySuccess = ref(null) // ID of song whose lyrics were just copied
const thumbnailErrors = ref({}) // { [songId]: true } when a thumbnail image fails to load
const showSongDetails = ref(false)
const selectedSongDetails = ref(null)

// Context Menu
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  song: null
})

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
  showActions.value = null
  contextMenu.value.show = false
  showFilterDropdown.value = false
}

const filteredSongs = computed(() => {
  return songs.value.filter(song => {
    const matchesCategory = selectedCategory.value === 'All' || song.category === selectedCategory.value
    const q = searchQuery.value.toLowerCase()
    const matchesSearch = song.title.toLowerCase().includes(q) ||
                          song.notes?.toLowerCase().includes(q) ||
                          song.lyrics?.toLowerCase().includes(q) ||
                          Object.values(song.leaderKeys || {}).some((key) => key?.toLowerCase().includes(q))
    return matchesCategory && matchesSearch
  })
})

const getThumbnail = (url) => getYoutubeThumbnail(url)

const detailsVideoId = computed(() => getYoutubeId(selectedSongDetails.value?.youtubeUrl))
const detailsLyrics = computed(() => songLyricsText(selectedSongDetails.value))

const handleThumbnailError = (songId) => {
  thumbnailErrors.value = { ...thumbnailErrors.value, [songId]: true }
}

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

const getCategoryColor = (category) => {
  const colors = {
    'Praise': 'text-amber-500 bg-amber-50 dark:bg-amber-900/10 border-transparent',
    'Worship': 'text-[#01779b] bg-[#01779b]/5 border-transparent',
    'Hymnal': 'text-purple-500 bg-purple-50 dark:bg-purple-900/10 border-transparent'
  }
  return colors[category] || 'text-gray-500 bg-gray-50 dark:bg-gray-800 border-transparent'
}

const handleAdd = () => {
  showSongDetails.value = false
  form.value = { ...initialForm, leaderKeys: buildLeaderKeys() }
  isEditing.value = false
  showForm.value = true
}

const formDialogRef = ref(null)
useFocusTrap(formDialogRef, showForm, () => { showForm.value = false })

const deleteDialogRef = ref(null)
useFocusTrap(deleteDialogRef, showDeleteModal, () => { showDeleteModal.value = false })

const openSongDetails = (song) => {
  showForm.value = false
  selectedSongDetails.value = song
  showSongDetails.value = true
}

const songDetailsRef = ref(null)
useFocusTrap(songDetailsRef, showSongDetails, () => { showSongDetails.value = false })

const handleEdit = (song) => {
  showSongDetails.value = false
  form.value = { ...initialForm, ...song, leaderKeys: buildLeaderKeys(song.leaderKeys || {}) }
  isEditing.value = true
  showForm.value = true
}

const handleSubmit = async () => {
  if (!form.value.title || !form.value.youtubeUrl) return
  isSubmitting.value = true
  try {
    if (isEditing.value) {
      await updateSong(form.value.id, {
        title: form.value.title,
        youtubeUrl: form.value.youtubeUrl,
        category: form.value.category,
        leaderKeys: form.value.leaderKeys,
        lyrics: form.value.lyrics || '',
        notes: form.value.notes
      })
    } else {
      await addSong(form.value)
    }
    showForm.value = false
  } catch (err) { alert("Submission failed.") } finally { isSubmitting.value = false }
}

const handleDelete = (song) => {
  songToDelete.value = song
  showDeleteModal.value = true
}

const confirmDelete = async () => {
  if (!songToDelete.value) return
  isSubmitting.value = true
  try {
    await deleteSong(songToDelete.value.id)
    showDeleteModal.value = false
    songToDelete.value = null
  } catch (err) { alert("Delete failed.") } finally { isSubmitting.value = false }
}

const copyToClipboard = async (song) => {
  if (!(await copyText(song.youtubeUrl))) {
    toast.error('Could not copy the link.')
    return
  }
  copySuccess.value = song.id
  setTimeout(() => { copySuccess.value = null }, 2000)
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
  lyricsCopySuccess.value = song.id
  setTimeout(() => { lyricsCopySuccess.value = null }, 2000)
  toast.success(`Lyrics copied — ${song.title}`)
}

const openLink = (url) => { window.open(url, '_blank') }

const openSongContext = (song, e) => {
  contextMenu.value = {
    show: true,
    x: e.clientX,
    y: e.clientY,
    song
  }
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden bg-transparent">

    <!-- Action Bar -->
    <div class="sticky top-0 z-40 mb-4 shrink-0 rounded-xl border border-gray-200/80 bg-white/95 px-2 py-2 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 sm:px-3">
      <div class="flex items-center justify-between gap-2 w-full flex-nowrap">
        <SearchBar v-model="searchQuery" v-model:open="mobileSearchOpen" placeholder="Search songs..." />

        <div :class="['flex items-center gap-1.5 sm:gap-2 flex-nowrap shrink-0 ml-auto', mobileSearchOpen ? 'hidden lg:flex' : 'flex']">
          <div class="relative">
            <button @click.stop="showFilterDropdown = !showFilterDropdown" :class="[ 'flex h-10 w-10 items-center justify-center rounded-lg transition-colors border border-transparent shrink-0', selectedCategory !== 'All' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600' ]">
              <ListFilter class="h-5 w-5" />
            </button>

            <Transition name="fade">
              <div v-if="showFilterDropdown" class="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 py-2 overflow-hidden">
                <button v-for="cat in categories" :key="cat" @click="selectedCategory = cat; showFilterDropdown = false" :class="[ 'w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors block', selectedCategory === cat ? 'text-primary bg-primary/5' : 'text-gray-500 dark:text-gray-400' ]">{{ cat }}</button>
              </div>
            </Transition>
          </div>
          <button v-if="canManage('songs')" @click="handleAdd" class="flex h-10 items-center justify-center rounded-lg bg-primary text-white shadow-sm transition-colors hover:bg-primary-hover dark:bg-primary dark:hover:bg-primary-hover px-2.5 sm:px-4 gap-1.5 w-10 sm:w-auto shrink-0"><Plus class="h-5 w-5 shrink-0" /> <span class="hidden sm:inline whitespace-nowrap">Add</span></button>
        </div>
      </div>
    </div>

    <!-- Main Workspace -->
    <div class="flex-1 flex overflow-hidden min-h-0">

      <!-- List Area -->
      <div class="flex-1 h-full overflow-y-auto p-4 custom-scrollbar bg-transparent">

        <!-- Loading State -->
        <div v-if="isLoading" class="space-y-1">
          <div v-for="i in 10" :key="i" class="h-16 bg-gray-50 dark:bg-gray-800/40 rounded-xl animate-pulse mx-2"></div>
        </div>

        <!-- Empty State -->
        <div v-else-if="filteredSongs.length === 0" class="flex flex-col items-center justify-center py-32 text-gray-400">
           <ListMusic class="h-16 w-16 mb-4 opacity-5" /><p class="text-sm font-semibold">No songs yet</p>
        </div>

        <!-- Professional List View -->
        <div v-else class="space-y-1 max-w-6xl mx-auto">
          <!-- Table Header -->
          <div class="hidden sm:flex items-center px-3 sm:px-6 py-2 mb-2 text-[11px] font-black uppercase tracking-wide text-gray-400 border-b border-gray-50 dark:border-gray-800">
            <div class="w-16">Video</div>
            <div class="flex-1 ml-4">Song Detail</div>
            <div class="w-32 hidden md:block">Category</div>
            <div class="w-24 text-right">Actions</div>
          </div>

          <div v-for="song in filteredSongs" :key="song.id"
            @click="openSongDetails(song)"
            @contextmenu.prevent="openSongContext(song, $event)"
            class="group flex items-center px-3 sm:px-6 py-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-white/5 border border-transparent hover:border-gray-100 dark:hover:border-gray-800 transition-all cursor-pointer relative"
            :class="{ 'opacity-80': contextMenu.show && contextMenu.song?.id === song.id }"
          >
            <!-- Start Column: Thumbnail -->
            <div class="w-16 h-11 rounded-lg bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-400 border border-gray-100 dark:border-gray-800 shrink-0 relative overflow-hidden">
              <img
                v-if="getThumbnail(song.youtubeUrl) && !thumbnailErrors[song.id]"
                :src="getThumbnail(song.youtubeUrl)"
                :alt="song.title"
                class="w-full h-full object-cover"
                @error="handleThumbnailError(song.id)"
              />
              <Youtube v-else class="h-5 w-5 text-red-500" />
              <div v-if="getThumbnail(song.youtubeUrl) && !thumbnailErrors[song.id]" class="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-colors">
                <div class="w-5 h-5 rounded-full bg-black/40 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
                  <Play class="h-2.5 w-2.5 text-white fill-white" />
                </div>
              </div>
            </div>

            <!-- Middle Column: Info -->
            <div class="flex-1 min-w-0 ml-3 sm:ml-4">
               <h3 class="font-bold text-gray-900 dark:text-white text-[14px] leading-tight flex items-center gap-2">
                 <span class="truncate">{{ song.title }}</span>
                 <FileText
                   v-if="hasLyrics(song)"
                   class="h-3 w-3 shrink-0 text-emerald-500"
                   title="Lyrics saved"
                 />
                 <span v-if="getLeaderKeySummary(song)" class="shrink-0 truncate max-w-45 text-[10px] font-bold text-gray-400 dark:text-gray-500">{{ getLeaderKeySummary(song) }}</span>
                 <ExternalLink class="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-40 transition-opacity hidden sm:block" />
               </h3>
               <p class="text-[11px] text-gray-400 font-medium truncate mt-0.5 opacity-80 decoration-gray-400/30 group-hover:underline">
                 {{ song.youtubeUrl }}
               </p>
               <p v-if="song.notes" class="text-[11px] text-gray-500 dark:text-gray-400 italic truncate mt-0.5">
                 {{ song.notes }}
               </p>
               <span :class="['md:hidden inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border', getCategoryColor(song.category)]">
                 {{ song.category }}
               </span>
            </div>

            <!-- Category Column -->
            <div class="w-32 hidden md:block">
               <span :class="['px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border', getCategoryColor(song.category)]">
                 {{ song.category }}
               </span>
            </div>

            <!-- End Column: Actions -->
            <div class="w-24 flex items-center justify-end gap-1">
               <button @click.stop="copyToClipboard(song)" class="p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 text-gray-400 hover:text-primary transition-all" title="Copy Link">
                  <Check v-if="copySuccess === song.id" class="h-4 w-4 text-green-500" />
                  <Copy v-else class="h-4 w-4" />
               </button>
               <button @click.stop="showActions = showActions === song.id ? null : song.id" class="p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all">
                  <MoreHorizontal class="h-4 w-4" />
               </button>

               <!-- Simple Popover -->
               <div v-if="showActions === song.id" class="absolute right-6 top-full mt-1 w-44 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl py-1 z-50 overflow-hidden" @click.stop>
                  <button v-if="hasLyrics(song)" @click="copyLyrics(song); showActions = null" class="w-full px-4 py-2 flex items-center gap-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-bold text-gray-700 dark:text-white transition-colors">
                    <FileText class="h-3.5 w-3.5 text-emerald-500" /> Copy Lyrics
                  </button>
                  <button @click="handleEdit(song); showActions = null" class="w-full px-4 py-2 flex items-center gap-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-bold text-gray-700 dark:text-white transition-colors">
                    <Edit3 class="h-3.5 w-3.5 text-blue-500" /> Edit
                  </button>
                  <button @click="handleDelete(song); showActions = null" class="w-full px-4 py-2 flex items-center gap-2.5 hover:bg-red-50 dark:hover:bg-red-500/10 text-sm font-bold text-red-500 transition-colors">
                    <Trash2 class="h-3.5 w-3.5" /> Delete
                  </button>
               </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Add/Edit Side Cabinet -->
      <Teleport to="body" :disabled="!isMobile">
      <Transition :name="isMobile ? 'modal-sheet' : 'panel'">
        <div v-if="showForm"
          :class="[
            isMobile
              ? 'fixed inset-0 z-80 flex flex-col justify-end'
              : 'song-details-drawer m-3 rounded-2xl border-2 border-primary/30 dark:border-primary-light/30 bg-white dark:bg-gray-800 w-[calc(40%-1rem)] h-[calc(100%-1.5rem)] flex flex-col shrink-0 shadow-xl shadow-primary/25 dark:shadow-primary-light/20 relative overflow-hidden z-60'
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
          <div class="shrink-0 rounded-t-2xl bg-linear-to-r from-primary/10 to-transparent dark:from-primary-light/10 dark:to-transparent border-b border-primary/20 dark:border-primary-light/20 px-4 sm:px-6 py-4 flex items-center justify-between">
            <div>
              <h3 id="song-form-drawer-title" class="text-md font-bold text-gray-900 dark:text-white uppercase tracking-tight">{{ isEditing ? 'Edit Song' : 'Add New Song' }}</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-bold">Song Details</p>
            </div>
            <button @click="showForm = false" aria-label="Close" class="p-2 rounded-lg text-gray-400 hover:text-primary dark:hover:text-primary-light hover:bg-gray-100 dark:hover:bg-gray-700 transition-all group">
              <X class="h-5 w-5 transition-transform group-hover:rotate-90" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6 custom-scrollbar">
            <section class="space-y-4">
              <div class="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-5 space-y-5 border border-gray-100 dark:border-gray-800">
                <div class="space-y-1.5 focus-within:text-primary transition-colors">
                  <label class="text-xs font-bold text-gray-400">Song Title</label>
                  <input v-model="form.title" type="text" placeholder="e.g., Way Maker" class="w-full bg-transparent border-b-2 border-gray-200 dark:border-gray-700 py-1 text-sm font-bold text-gray-900 dark:text-white focus:border-primary outline-none transition-all" />
                </div>
                <div class="space-y-1.5 focus-within:text-primary transition-colors pt-2">
                  <label class="text-xs font-bold text-gray-400">YouTube Link</label>
                  <input v-model="form.youtubeUrl" type="url" placeholder="https://youtube.com/..." class="w-full bg-transparent border-b-2 border-gray-200 dark:border-gray-700 py-1 text-sm font-bold text-primary dark:text-primary-light focus:border-primary outline-none transition-all" />
                </div>
                <!-- YouTube Detection Tag -->
                <div v-if="form.youtubeUrl" class="flex items-center gap-2 pt-2">
                   <div v-if="getYoutubeId(form.youtubeUrl)" class="p-1 px-3 rounded-full bg-primary/10 text-sm font-bold text-primary flex items-center gap-2">
                     <Youtube class="h-3 w-3" /> YouTube Link Detected
                   </div>
                   <div v-else class="p-1 px-3 rounded-full bg-amber-500/10 text-sm font-bold text-amber-600 flex items-center gap-2">
                     <AlertTriangle class="h-3 w-3" /> Not recognized as a YouTube link
                   </div>
                </div>
              </div>
            </section>

            <section class="space-y-4">
              <div class="grid grid-cols-1 gap-4">
                  <div class="space-y-1.5">
                    <p class="text-xs font-bold text-gray-400 ml-1">Category</p>
                    <div class="grid grid-cols-3 gap-2">
                       <button v-for="cat in categories.slice(1)" :key="cat" @click="form.category = cat" :class="[ 'px-3 py-2.5 rounded-xl border-2 text-sm font-bold transition-all', form.category === cat ? 'bg-primary border-primary text-white' : 'border-gray-100 dark:border-gray-700 text-gray-500 hover:border-primary/30' ]">{{ cat }}</button>
                    </div>
                  </div>
                </div>
            </section>

            <section class="space-y-4">
              <div class="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-5 space-y-3 border border-gray-100 dark:border-gray-800">
                <label class="text-xs font-bold text-gray-400">Song Leader Keys</label>
                <div v-if="songLeaders.length > 0" class="space-y-3">
                  <div v-for="leader in songLeaders" :key="leader.id" class="flex items-center gap-3">
                    <span class="flex-1 min-w-0 truncate text-sm font-bold text-gray-700 dark:text-gray-300">{{ getFullName(leader) }}</span>
                    <input
                      v-model="form.leaderKeys[leader.id]"
                      type="text"
                      placeholder="e.g., G"
                      class="w-24 shrink-0 bg-white dark:bg-gray-800 border-b-2 border-gray-200 dark:border-gray-700 py-1 px-2 text-sm font-bold text-center text-gray-900 dark:text-white focus:border-primary outline-none transition-all"
                    />
                  </div>
                </div>
                <p v-else class="text-sm text-gray-400 italic py-1">No members tagged "Song Leader" yet — assign it from the Members page.</p>
              </div>
            </section>

            <section class="space-y-2">
              <div class="ml-1 flex items-center justify-between gap-2">
                <h4 class="text-xs font-bold text-gray-400 flex items-center gap-2">
                  <FileText class="h-3.5 w-3.5" /> Lyrics
                </h4>
                <span class="text-[10px] font-bold uppercase tracking-widest text-gray-300 dark:text-gray-600">For tech</span>
              </div>
              <textarea
                v-model="form.lyrics"
                rows="12"
                spellcheck="false"
                class="w-full bg-gray-50 dark:bg-gray-700/30 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 text-sm font-medium leading-relaxed text-gray-600 dark:text-gray-300 outline-none focus:ring-2 focus:ring-primary/20 whitespace-pre-wrap"
                placeholder="Paste the lyrics here.&#10;&#10;Leave a blank line between stanzas — the tech team copies this straight into the slides, so the line breaks you type are the line breaks they get."
              ></textarea>
            </section>

            <section class="space-y-4">
              <h4 class="text-xs font-bold text-gray-400 flex items-center gap-2 ml-1">Notes</h4>
              <textarea v-model="form.notes" rows="5" class="w-full bg-gray-50 dark:bg-gray-700/30 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 text-sm font-medium text-gray-600 dark:text-gray-300 outline-none focus:ring-2 focus:ring-primary/20" placeholder="Lead singer, arrangement notes, transitions..."></textarea>
            </section>
          </div>

          <div class="shrink-0 rounded-b-2xl bg-linear-to-r from-primary/10 to-transparent dark:from-primary-light/10 dark:to-transparent border-t border-primary/20 dark:border-primary-light/20 px-4 sm:px-6 py-5">
            <button @click="handleSubmit" :disabled="isSubmitting || !form.title || !form.youtubeUrl" class="group w-full py-4 bg-primary text-white rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all flex items-center justify-center gap-2">
              <Loader2 v-if="isSubmitting" class="h-4 w-4 animate-spin" />
              <span v-else>{{ isEditing ? 'Save Changes' : 'Add Song' }}</span>
              <ArrowRight v-if="!isSubmitting" class="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
          </div>
        </div>
      </Transition>
      </Teleport>

      <!-- Song Details Drawer (same placement/design as the Add/Edit drawer) -->
      <Teleport to="body" :disabled="!isMobile">
      <Transition :name="isMobile ? 'modal-sheet' : 'panel'">
        <div v-if="showSongDetails && selectedSongDetails"
          :class="[
            isMobile
              ? 'fixed inset-0 z-80 flex flex-col justify-end'
              : 'song-view-drawer m-3 rounded-2xl border-2 border-primary/30 dark:border-primary-light/30 bg-white dark:bg-gray-800 w-[calc(40%-1rem)] h-[calc(100%-1.5rem)] flex flex-col shrink-0 shadow-xl shadow-primary/25 dark:shadow-primary-light/20 relative overflow-hidden z-60'
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
          <div class="shrink-0 rounded-t-2xl bg-linear-to-r from-primary/10 to-transparent dark:from-primary-light/10 dark:to-transparent border-b border-primary/20 dark:border-primary-light/20 px-4 sm:px-6 py-4 flex items-center justify-between">
            <div>
              <h3 id="song-view-title" class="text-md font-bold text-gray-900 dark:text-white uppercase tracking-tight">{{ selectedSongDetails.title }}</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-bold">Song Details</p>
            </div>
            <button @click="showSongDetails = false" aria-label="Close" class="p-2 rounded-lg text-gray-400 hover:text-primary dark:hover:text-primary-light hover:bg-gray-100 dark:hover:bg-gray-700 transition-all group">
              <X class="h-5 w-5 transition-transform group-hover:rotate-90" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6 custom-scrollbar">
            <section class="space-y-4">
              <div class="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3 sm:p-5 space-y-4 border border-gray-100 dark:border-gray-800">
                <SongPlayer
                  v-if="detailsVideoId"
                  :video-id="detailsVideoId"
                  :title="selectedSongDetails.title"
                />
                <div v-else class="w-full aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center gap-2 text-center px-4">
                  <Youtube class="h-8 w-8 text-red-500" />
                  <p class="text-xs font-bold text-gray-400">This link isn't a YouTube video, so it can't play here.</p>
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs font-bold text-gray-400">YouTube Link</label>
                  <p class="text-sm font-bold text-primary dark:text-primary-light break-all">{{ selectedSongDetails.youtubeUrl }}</p>
                </div>
              </div>
            </section>

            <section class="space-y-4">
              <div class="space-y-1.5 ml-1">
                <p class="text-xs font-bold text-gray-400">Category</p>
                <span :class="['inline-block px-3 py-1.5 rounded-xl text-sm font-bold border', getCategoryColor(selectedSongDetails.category)]">{{ selectedSongDetails.category }}</span>
              </div>
            </section>

            <section v-if="getLeaderKeyEntries(selectedSongDetails).length > 0" class="space-y-4">
              <div class="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-5 space-y-3 border border-gray-100 dark:border-gray-800">
                <label class="text-xs font-bold text-gray-400">Song Leader Keys</label>
                <div class="space-y-2">
                  <div v-for="entry in getLeaderKeyEntries(selectedSongDetails)" :key="entry.name" class="flex items-center justify-between gap-3">
                    <span class="text-sm font-bold text-gray-700 dark:text-gray-300 truncate">{{ entry.name }}</span>
                    <span class="text-sm font-black text-primary dark:text-primary-light shrink-0">{{ entry.key }}</span>
                  </div>
                </div>
              </div>
            </section>

            <!-- Lyrics: the tech team's copy-and-paste source for the slides -->
            <section class="space-y-2">
              <div class="ml-1 flex items-center justify-between gap-2">
                <h4 class="text-xs font-bold text-gray-400 flex items-center gap-2">
                  <FileText class="h-3.5 w-3.5" /> Lyrics
                </h4>
                <button
                  v-if="detailsLyrics"
                  @click="copyLyrics(selectedSongDetails)"
                  class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100 hover:text-primary dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-primary-light transition-colors"
                >
                  <Check v-if="lyricsCopySuccess === selectedSongDetails.id" class="h-3.5 w-3.5 text-green-500" />
                  <Copy v-else class="h-3.5 w-3.5" />
                  {{ lyricsCopySuccess === selectedSongDetails.id ? 'Copied' : 'Copy' }}
                </button>
              </div>

              <pre
                v-if="detailsLyrics"
                class="w-full max-h-96 overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-gray-700/30 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 text-sm font-sans font-medium leading-relaxed text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words select-text"
              >{{ detailsLyrics }}</pre>

              <div v-else class="w-full bg-gray-50 dark:bg-gray-700/30 rounded-2xl p-4 border border-dashed border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-400">
                No lyrics saved yet.
                <button
                  v-if="canManage('songs')"
                  @click="handleEdit(selectedSongDetails)"
                  class="font-bold text-primary dark:text-primary-light hover:underline"
                >
                  Add them
                </button>
                <span v-else>Ask a worship lead to add them.</span>
              </div>
            </section>

            <section v-if="selectedSongDetails.notes" class="space-y-4">
              <h4 class="text-xs font-bold text-gray-400 flex items-center gap-2 ml-1">Notes</h4>
              <div class="w-full bg-gray-50 dark:bg-gray-700/30 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 text-sm font-medium text-gray-600 dark:text-gray-300">{{ selectedSongDetails.notes }}</div>
            </section>
          </div>

          <div class="shrink-0 rounded-b-2xl bg-linear-to-r from-primary/10 to-transparent dark:from-primary-light/10 dark:to-transparent border-t border-primary/20 dark:border-primary-light/20 px-4 sm:px-6 py-5">
            <button @click="openLink(selectedSongDetails.youtubeUrl)" class="group w-full py-4 bg-red-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all flex items-center justify-center gap-2">
              <Youtube class="h-4 w-4" /> Watch on YouTube
            </button>
          </div>
          </div>
        </div>
      </Transition>
      </Teleport>
    </div>

    <!-- Context Menu -->
    <Transition name="fade">
      <div v-if="contextMenu.show"
        class="fixed z-500 w-56 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl py-2 overflow-hidden animate-in"
        :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
        @click.stop
      >
        <div class="px-5 py-3 border-b border-gray-100 dark:border-gray-800 mb-1 flex items-center justify-between">
           <div class="min-w-0">
             <p class="text-[11px] font-black text-primary uppercase tracking-widest">{{ contextMenu.song.category }}</p>
             <p class="text-sm font-bold text-gray-900 dark:text-white truncate">{{ contextMenu.song.title }}</p>
           </div>
           <Youtube class="h-4 w-4 text-gray-400" />
        </div>
        <button @click="openLink(contextMenu.song.youtubeUrl); closeMenus()" class="w-full px-5 py-3 flex items-center gap-3 hover:bg-primary/10 text-sm font-bold text-gray-700 dark:text-white transition-colors">
          <ExternalLink class="h-4 w-4 text-primary" /> Launch
        </button>
        <button @click="copyToClipboard(contextMenu.song); closeMenus()" class="w-full px-5 py-3 flex items-center gap-3 hover:bg-primary/10 text-sm font-bold text-gray-700 dark:text-white transition-colors">
          <Copy class="h-4 w-4" /> Copy Link
        </button>
        <button v-if="hasLyrics(contextMenu.song)" @click="copyLyrics(contextMenu.song); closeMenus()" class="w-full px-5 py-3 flex items-center gap-3 hover:bg-primary/10 text-sm font-bold text-gray-700 dark:text-white transition-colors">
          <FileText class="h-4 w-4 text-emerald-500" /> Copy Lyrics
        </button>
        <div class="h-px bg-gray-100 dark:bg-gray-800 my-1"></div>
        <button @click="handleEdit(contextMenu.song); closeMenus()" class="w-full px-5 py-3 flex items-center gap-3 hover:bg-primary/10 text-sm font-bold text-primary transition-colors">
          <Edit3 class="h-4 w-4" /> Edit
        </button>
        <button @click="handleDelete(contextMenu.song); closeMenus()" class="w-full px-5 py-3 flex items-center gap-3 hover:bg-red-500/10 text-sm font-bold text-red-500 transition-colors">
          <Trash2 class="h-4 w-4" /> Delete
        </button>
      </div>
    </Transition>

    <!-- Confirm Delete Modal (Standard Premium) -->
    <Transition name="modal">
      <div v-if="showDeleteModal" class="fixed inset-0 z-200 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click="showDeleteModal = false">
        <div
          ref="deleteDialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="song-delete-modal-title"
          tabindex="-1"
          class="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden transform transition-all"
          @click.stop
        >
          <div class="p-8 text-center">
            <div class="mx-auto w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-6">
              <AlertTriangle class="h-8 w-8 text-red-500" />
            </div>
            <h3 id="song-delete-modal-title" class="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">Delete Song?</h3>
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400 leading-relaxed mb-8 px-4 opacity-70">"{{ songToDelete?.title }}"</p>
            <div class="flex flex-col gap-3">
              <button @click="confirmDelete" :disabled="isSubmitting" class="w-full py-4 bg-red-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all flex items-center justify-center gap-2"><Loader2 v-if="isSubmitting" class="h-4 w-4 animate-spin" /><span v-else>Confirm Permanent Removal</span></button>
              <button @click="showDeleteModal = false" class="w-full py-4 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-white rounded-2xl font-bold text-sm hover:bg-gray-200 transition-all">Keep Song</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.modal-enter-from, .modal-leave-to { opacity: 0; transform: scale(0.95); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.song-details-drawer,
.song-view-drawer {
  transition: max-width 0.3s ease-out, opacity 0.3s ease;
}

.panel-enter-from, .panel-leave-to {
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

.animate-in { animation: animateIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes animateIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>
