<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import GalleryToolbar from '../components/gallery/GalleryToolbar.vue'
import GalleryFab from '../components/gallery/GalleryFab.vue'
import AlbumCard from '../components/gallery/AlbumCard.vue'
import AlbumRow from '../components/gallery/AlbumRow.vue'
import NewAlbumSheet from '../components/gallery/NewAlbumSheet.vue'
import PhotoLightbox from '../components/gallery/PhotoLightbox.vue'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'
import { useGalleryAlbums, matchesAlbumQuery, RECENT_EMPTY_DAYS } from '../composables/useGalleryAlbums'
import { useListScrollMemory } from '../composables/useListScrollMemory'
import { usePermissions } from '../composables/usePermissions'
import { useToast } from '../composables/useToast'
import {
  addAlbum,
  deleteAlbum,
  deletePhoto,
  setAlbumCover,
  subscribeToAlbumPhotos,
  uploadPhoto,
} from '../api/galleryService'
import { compressImageToBase64 } from '../utils/imageUtils'
import { addDays, formatLongDate, formatMonth } from '../../lib/occurrences'
import { ArrowLeft, Image as ImageIcon, ImagePlus, SearchX, Trash2 } from '../icons'

const props = defineProps({
  id: String,
  view: String,
  photoId: String,
})

const router = useRouter()
const toast = useToast()
const { canManage } = usePermissions()
const canEdit = computed(() => canManage('gallery'))

const { albums, loading, today } = useGalleryAlbums()

/* ------------------------------------------------------------------ search */
const searchQuery = ref('')
// Search is a mode, opened from the floating button. Closing it clears the
// query: a bar you cannot see must not still be filtering the list.
const searchOpen = ref(false)
const openSearch = () => { searchOpen.value = true }
const closeSearch = () => {
  searchOpen.value = false
  searchQuery.value = ''
}
const searching = computed(() => Boolean(searchQuery.value.trim()))

/* ------------------------------------------------------------------- list */
// Covers whose file failed to load. Kept by id so the album drops to a row for
// the rest of the visit instead of retrying a broken image on every render.
const brokenCovers = ref(new Set())
const markBroken = (album) => {
  const next = new Set(brokenCovers.value)
  next.add(album.id)
  brokenCovers.value = next
}

const listed = computed(() =>
  albums.value.map((album) =>
    album.hasPhotos && brokenCovers.value.has(album.id)
      ? { ...album, hasPhotos: false, coverBroken: true }
      : album
  )
)

// An empty album is an invitation to add photos, and only somebody who can add
// them has any use for one. Everybody else sees the albums with pictures in.
const offered = computed(() =>
  listed.value.filter((album) => album.hasPhotos || album.coverBroken || canEdit.value)
)

const recentFrom = computed(() => addDays(today.value, -RECENT_EMPTY_DAYS))

// A gathering that is not recent and still has nothing in it is left off the
// unsearched list — see RECENT_EMPTY_DAYS. A stored album is never left off:
// somebody made it, so it is theirs to find or delete.
const isStale = (album) =>
  !album.hasPhotos && !album.existsInGallery && String(album.date) < recentFrom.value

const visibleAlbums = computed(() =>
  searching.value
    ? offered.value.filter((album) => matchesAlbumQuery(album, searchQuery.value))
    : offered.value.filter((album) => !isStale(album))
)

const staleCount = computed(() =>
  searching.value ? 0 : offered.value.filter(isStale).length
)

// Month by month, newest first. Within a month the albums with photos lead as
// covers and the empty ones follow as a short list — mixing the two by date
// would break the grid into single cards between rows.
const albumGroups = computed(() => {
  const groups = new Map()
  for (const album of visibleAlbums.value) {
    const key = album.date ? String(album.date).slice(0, 7) : 'undated'
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: album.date ? formatMonth(album.date) : 'No date',
        covers: [],
        empties: [],
      })
    }
    groups.get(key)[album.hasPhotos ? 'covers' : 'empties'].push(album)
  }
  return [...groups.values()].sort((a, b) =>
    a.key === 'undated' ? 1 : b.key === 'undated' ? -1 : b.key.localeCompare(a.key)
  )
})

// Opening an album replaces the list in place, so the list has to remember
// where it was — both across this page's own album view and across leaving
// the page altogether.
const listScroller = ref(null)
useListScrollMemory(listScroller, { key: '/gallery' })
let listScrollTop = 0

/* ------------------------------------------------------------------ album */
const routeAlbumId = computed(() => (props.id && props.id !== 'all' ? props.id : ''))

const currentAlbum = computed(() => {
  const id = routeAlbumId.value
  if (!id) return null
  return listed.value.find((album) => album.id === id || album.derivedId === id) || null
})

// A gathering's album has a computed id until its first photo is saved and a
// document id after. The address follows, so a link copied from here opens
// the album itself rather than the gathering it started as.
watch(currentAlbum, (album) => {
  if (!album || album.id === routeAlbumId.value) return
  router.replace({
    name: 'Gallery',
    params: { id: album.id, view: props.view, photoId: props.photoId },
  })
})

watch(routeAlbumId, async (id, previous) => {
  if (id && !previous) {
    listScrollTop = listScroller.value?.scrollTop || 0
    closeSearch()
  } else if (!id && previous) {
    await nextTick()
    if (listScroller.value) listScroller.value.scrollTop = listScrollTop
  }
})

const photos = ref([])
const photosLoading = ref(false)
let unsubscribePhotos = null

// Only a stored album has photos to read. A gathering's album is empty by
// definition until the first upload makes it a document.
const photoSourceId = computed(() =>
  currentAlbum.value?.existsInGallery ? currentAlbum.value.id : ''
)

watch(
  photoSourceId,
  (albumId) => {
    unsubscribePhotos?.()
    unsubscribePhotos = null
    photos.value = []
    photosLoading.value = Boolean(albumId)
    if (!albumId) return
    unsubscribePhotos = subscribeToAlbumPhotos(albumId, (data) => {
      photos.value = data
      photosLoading.value = false
    })
  },
  { immediate: true }
)

onUnmounted(() => unsubscribePhotos?.())

const albumDetail = computed(() => {
  const album = currentAlbum.value
  if (!album) return ''
  const count = photos.value.length
  return [
    album.date ? formatLongDate(album.date) : '',
    album.location,
    count ? `${count} ${count === 1 ? 'photo' : 'photos'}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
})

const openAlbum = (album) => {
  router.push({ name: 'Gallery', params: { id: album.id } })
}

// Back to the list the way the phone's own back button would go, when that is
// where the album was opened from; a link straight into an album has no list
// behind it, so that one goes forward to it instead.
const closeAlbum = () => {
  if (window.history.state?.back === '/gallery') router.back()
  else router.push({ name: 'Gallery' })
}

/* ----------------------------------------------------------------- upload */
const fileInput = ref(null)
const uploadTarget = ref(null)
// The album being uploaded into, by every id it may be known by during the
// upload — it starts as a gathering and becomes a document part-way through.
const uploadingIds = ref([])
const progress = ref({ done: 0, total: 0 })
const uploading = computed(() => uploadingIds.value.length > 0)

const isUploadingTo = (album) =>
  Boolean(album) &&
  uploadingIds.value.some((id) => id === album.id || id === album.derivedId)

// Straight from the tap, not after an await: a browser only opens the file
// picker inside the gesture that asked for it.
const pickPhotosFor = (album) => {
  if (!album || !canEdit.value) return
  // A second batch while the first is going would race it for the cover and
  // share one progress bar between two albums.
  if (uploading.value) {
    toast.info('Wait for the photos already going up to finish.')
    return
  }
  uploadTarget.value = album
  fileInput.value?.click()
}

const onRowTap = (album) => {
  // A row standing in for a broken cover still has photos behind it; opening
  // the album shows them, where the picker would only add more.
  if (album.coverBroken) openAlbum(album)
  else pickPhotosFor(album)
}

const onFilesChosen = (event) => {
  const files = Array.from(event.target.files || [])
  event.target.value = ''
  const album = uploadTarget.value
  uploadTarget.value = null
  if (!files.length || !album) return
  uploadInto(album, files)
}

/**
 * Puts photos into an album, creating the album first if it is still only a
 * gathering. The page moves into the album as soon as the upload starts, so
 * the photos are seen arriving where they are going.
 */
const uploadInto = async (album, files) => {
  uploadingIds.value = [album.id, album.derivedId].filter(Boolean)
  progress.value = { done: 0, total: files.length }

  if (album.id && routeAlbumId.value !== album.id) openAlbum(album)

  let albumId = album.existsInGallery ? album.id : ''
  try {
    if (!albumId) {
      albumId = await addAlbum({
        title: album.title,
        date: album.date,
        category: album.category || 'General',
        location: album.location || '',
        description: album.description || '',
        calendarEventId: album.calendarEventId || null,
      })
      uploadingIds.value = [...uploadingIds.value, albumId]
      if (!album.id) router.push({ name: 'Gallery', params: { id: albumId } })
    }
  } catch (error) {
    console.error('Error creating album:', error)
    toast.error('Could not create the album. Please try again.')
    uploadingIds.value = []
    return
  }

  // One at a time, and a bad file does not stop the rest: twenty photos from a
  // service should not all be lost to the one that was a screenshot of a PDF.
  let failed = 0
  for (const file of files) {
    try {
      const base64 = await compressImageToBase64(file)
      await uploadPhoto(albumId, base64, '')
    } catch (error) {
      failed += 1
      console.error('Error uploading photo:', error)
    }
    progress.value = { ...progress.value, done: progress.value.done + 1 }
  }

  const added = files.length - failed
  if (failed) {
    toast.error(
      added
        ? `${added} added, ${failed} could not be uploaded.`
        : 'Those photos could not be uploaded. Please try again.'
    )
  } else {
    toast.success(`${added} ${added === 1 ? 'photo' : 'photos'} added`)
  }
  uploadingIds.value = []
}

/* ------------------------------------------------------------- new album */
const showNewAlbum = ref(false)

const createAlbum = ({ title, date, location, files }) => {
  showNewAlbum.value = false
  uploadInto(
    {
      id: '',
      title,
      date,
      location,
      category: 'General',
      description: '',
      calendarEventId: null,
      existsInGallery: false,
    },
    files
  )
}

/* ----------------------------------------------------------------- photos */
const photoIndex = computed(() =>
  props.view === 'v' && props.photoId
    ? photos.value.findIndex((photo) => photo.id === props.photoId)
    : -1
)
const lightboxOpen = computed(() => photoIndex.value !== -1)

const openPhoto = (photo) => {
  router.push({
    name: 'Gallery',
    params: { id: currentAlbum.value.id, view: 'v', photoId: photo.id },
  })
}

// Replaced rather than pushed: a swipe through forty photos should not leave
// forty entries for the back button to walk through.
const goToPhoto = (index) => {
  const photo = photos.value[index]
  if (!photo) return
  router.replace({
    name: 'Gallery',
    params: { id: currentAlbum.value.id, view: 'v', photoId: photo.id },
  })
}

const closePhoto = () => {
  const albumPath = `/gallery/${currentAlbum.value?.id}`
  if (window.history.state?.back === albumPath) router.back()
  else router.replace({ name: 'Gallery', params: { id: currentAlbum.value?.id } })
}

const sharePhoto = async (photo) => {
  const album = currentAlbum.value
  const url = `${window.location.origin}/gallery/${album.id}/v/${photo.id}`
  if (navigator.share) {
    try {
      await navigator.share({ title: album.title, text: album.title, url })
    } catch (error) {
      // Dismissing the share sheet rejects too, and is not a failure.
      if (error?.name !== 'AbortError') console.error('Share failed:', error)
    }
    return
  }
  try {
    await navigator.clipboard.writeText(url)
    toast.success('Link copied')
  } catch {
    toast.error('Could not copy the link.')
  }
}

// Fetched and saved as a file. The old way drew the photo onto a canvas first,
// which a browser refuses to export for an image served from another origin —
// and every photo lives in Blob storage now, so it failed for all of them.
const downloadPhoto = async (photo) => {
  try {
    const response = await fetch(photo.url)
    const blob = await response.blob()
    const extension = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = `photo-${photo.id}.${extension}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(href), 1000)
  } catch (error) {
    console.error('Download failed:', error)
    window.open(photo.url, '_blank', 'noopener')
  }
}

const useAsCover = async (photo) => {
  try {
    await setAlbumCover(currentAlbum.value.id, photo.url)
    toast.success('Cover updated')
  } catch (error) {
    console.error('Error setting cover:', error)
    toast.error('Could not change the cover. Please try again.')
  }
}

/* ---------------------------------------------------------------- deleting */
const showConfirmation = ref(false)
const confirmationConfig = ref({
  title: 'Confirm Action',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  confirmButtonClass: 'bg-red-600 text-white hover:bg-red-700',
  onConfirm: null,
})

const showConfirmModal = (config) => {
  confirmationConfig.value = { ...confirmationConfig.value, ...config }
  showConfirmation.value = true
}

const handleConfirmation = () => confirmationConfig.value.onConfirm?.()

const confirmDeletePhoto = (photo) => {
  showConfirmModal({
    title: 'Delete photo',
    message: 'This photo will be removed from the album for good.',
    confirmText: 'Delete',
    onConfirm: async () => {
      const albumId = currentAlbum.value?.id
      try {
        await deletePhoto(photo.id)
        router.replace({ name: 'Gallery', params: { id: albumId } })
        toast.success('Photo deleted')
      } catch (error) {
        console.error('Error deleting photo:', error)
        toast.error('Could not delete that photo. Please try again.')
      }
    },
  })
}

const confirmDeleteAlbum = () => {
  const album = currentAlbum.value
  if (!album?.existsInGallery) return
  const count = photos.value.length
  showConfirmModal({
    title: 'Delete album',
    message: count
      ? `Delete "${album.title}" and its ${count} ${count === 1 ? 'photo' : 'photos'}? This cannot be undone.`
      : `Delete "${album.title}"? This cannot be undone.`,
    confirmText: 'Delete',
    onConfirm: async () => {
      try {
        await deleteAlbum(album.id)
        router.push({ name: 'Gallery' })
        toast.success('Album deleted')
      } catch (error) {
        console.error('Error deleting album:', error)
        toast.error('Could not delete that album. Please try again.')
      }
    },
  })
}
</script>

<template>
  <div class="relative flex h-full flex-col">
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      multiple
      class="hidden"
      @change="onFilesChosen"
    />

    <!-- Opened from the floating button rather than always sitting there. -->
    <GalleryToolbar
      v-if="!routeAlbumId"
      :search-query="searchQuery"
      :open="searchOpen"
      :result-count="visibleAlbums.length"
      :total-count="offered.length"
      @update:search-query="searchQuery = $event"
      @close="closeSearch"
    />

    <div class="relative flex flex-1 overflow-hidden">
      <!-- ============================ Album list ============================ -->
      <!-- Full-bleed on a phone, a card from sm: up, the way Minutes sits. -->
      <div
        v-if="!routeAlbumId"
        ref="listScroller"
        class="flex-1 overflow-y-auto bg-white pb-20 sm:rounded-lg sm:border sm:border-gray-200 dark:bg-gray-800 sm:dark:border-gray-700"
      >
        <div v-if="loading">
          <div class="px-3 py-2 sm:px-4">
            <div class="h-3 w-24 rounded bg-gray-200 animate-pulse dark:bg-gray-600"></div>
          </div>
          <div class="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 sm:gap-3 sm:p-3 lg:grid-cols-4 xl:grid-cols-5">
            <div
              v-for="i in 4"
              :key="`card-${i}`"
              class="aspect-4/3 rounded-xl bg-gray-200 animate-pulse dark:bg-gray-700"
            ></div>
          </div>
          <div class="divide-y divide-gray-100 dark:divide-gray-700/60">
            <div v-for="i in 3" :key="`row-${i}`" class="flex items-center gap-3 px-3 py-2 sm:px-4">
              <div class="h-9 w-9 shrink-0 rounded-lg bg-gray-200 animate-pulse dark:bg-gray-600"></div>
              <div class="flex-1 space-y-1.5">
                <div class="h-3.5 w-40 rounded bg-gray-200 animate-pulse dark:bg-gray-600"></div>
                <div class="h-3 w-24 rounded bg-gray-200 animate-pulse dark:bg-gray-600"></div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="visibleAlbums.length === 0" class="px-6 py-16 text-center">
          <component
            :is="searching ? SearchX : ImageIcon"
            class="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600"
          />
          <p class="text-sm font-medium text-gray-600 dark:text-gray-300">
            {{ searching ? 'No album matches that.' : 'No photos yet' }}
          </p>
          <p class="mx-auto mt-1 max-w-xs text-xs text-gray-400 dark:text-gray-500">
            {{ searching
              ? 'Try the month, the gathering, or where it was.'
              : canEdit
                ? 'Every gathering gets an album here once it has happened.'
                : 'Photos from services and events will show up here.' }}
          </p>
        </div>

        <template v-else>
          <section v-for="group in albumGroups" :key="group.key">
            <h3
              class="sticky top-0 z-10 border-b border-gray-100 bg-white/95 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 backdrop-blur sm:px-4 dark:border-gray-700/60 dark:bg-gray-800/95 dark:text-gray-500"
            >
              {{ group.label }}
            </h3>

            <div
              v-if="group.covers.length"
              class="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 sm:gap-3 sm:p-3 lg:grid-cols-4 xl:grid-cols-5"
            >
              <AlbumCard
                v-for="album in group.covers"
                :key="album.id"
                :album="album"
                @open="openAlbum"
                @broken="markBroken"
              />
            </div>

            <div
              v-if="group.empties.length"
              class="divide-y divide-gray-100 dark:divide-gray-700/60"
            >
              <AlbumRow
                v-for="album in group.empties"
                :key="album.id"
                :album="album"
                :uploading="isUploadingTo(album)"
                @add="onRowTap"
              />
            </div>
          </section>

          <p
            v-if="staleCount && canEdit"
            class="px-6 py-6 text-center text-xs text-gray-400 dark:text-gray-500"
          >
            Older gatherings without photos turn up when you search for them.
          </p>
        </template>
      </div>

      <!-- ============================== One album ============================= -->
      <div
        v-else
        class="flex min-w-0 flex-1 flex-col overflow-hidden bg-white sm:rounded-lg sm:border sm:border-gray-200 dark:bg-gray-800 sm:dark:border-gray-700"
      >
        <div
          class="flex shrink-0 items-center gap-2 border-b border-gray-100 px-2 py-2 sm:px-3 dark:border-gray-700/60"
        >
          <button
            @click="closeAlbum"
            aria-label="Back to albums"
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <ArrowLeft class="h-5 w-5" />
          </button>
          <div class="min-w-0 flex-1">
            <h2 class="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {{ currentAlbum?.title || (loading ? '' : 'Album') }}
            </h2>
            <p class="truncate text-xs text-gray-500 dark:text-gray-400">{{ albumDetail }}</p>
          </div>
          <button
            v-if="canEdit && currentAlbum?.existsInGallery"
            @click="confirmDeleteAlbum"
            aria-label="Delete album"
            title="Delete album"
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          >
            <Trash2 class="h-4.5 w-4.5" />
          </button>
        </div>

        <!-- Progress, under the header rather than over the photos, so the
             ones that have landed can be looked at while the rest go up. -->
        <div
          v-if="isUploadingTo(currentAlbum) || (uploading && !currentAlbum)"
          class="shrink-0 border-b border-gray-100 px-3 py-2 sm:px-4 dark:border-gray-700/60"
        >
          <div class="flex items-center justify-between text-xs font-medium text-gray-600 dark:text-gray-300">
            <span>Adding photos…</span>
            <span class="tabular-nums">{{ progress.done }} of {{ progress.total }}</span>
          </div>
          <div class="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
            <div
              class="h-full rounded-full bg-primary transition-all duration-300"
              :style="{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }"
            ></div>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto pb-20">
          <div
            v-if="loading || photosLoading || (uploading && !currentAlbum)"
            class="grid grid-cols-3 gap-0.5 p-0.5 sm:grid-cols-4 sm:gap-1 sm:p-1 lg:grid-cols-6"
          >
            <div
              v-for="i in 12"
              :key="i"
              class="aspect-square bg-gray-200 animate-pulse dark:bg-gray-700"
            ></div>
          </div>

          <div v-else-if="!currentAlbum" class="px-6 py-16 text-center">
            <SearchX class="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p class="text-sm font-medium text-gray-600 dark:text-gray-300">
              This album is not here any more.
            </p>
            <button
              @click="router.push({ name: 'Gallery' })"
              class="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              All albums
            </button>
          </div>

          <div
            v-else-if="photos.length"
            class="grid grid-cols-3 gap-0.5 p-0.5 sm:grid-cols-4 sm:gap-1 sm:p-1 lg:grid-cols-6"
          >
            <button
              v-for="photo in photos"
              :key="photo.id"
              type="button"
              @click="openPhoto(photo)"
              class="relative aspect-square overflow-hidden bg-gray-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none dark:bg-gray-900"
              :aria-label="`Open photo from ${currentAlbum.title}`"
            >
              <img
                :src="photo.url"
                alt=""
                loading="lazy"
                decoding="async"
                class="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
              />
            </button>
          </div>

          <!-- Reached by a link, or by a manager who backed out of the picker.
               The list never draws an empty album this large. -->
          <div v-else-if="!isUploadingTo(currentAlbum)" class="px-6 py-16 text-center">
            <ImagePlus class="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p class="text-sm font-medium text-gray-600 dark:text-gray-300">
              Nothing in this album yet
            </p>
            <button
              v-if="canEdit"
              @click="pickPhotosFor(currentAlbum)"
              class="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              Add photos
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Floating actions -->
    <GalleryFab
      v-if="!routeAlbumId || (canEdit && currentAlbum)"
      :can-manage="canEdit"
      :in-album="Boolean(routeAlbumId)"
      :uploading="uploading"
      @search="openSearch"
      @add="showNewAlbum = true"
      @upload="pickPhotosFor(currentAlbum)"
    />

    <NewAlbumSheet :show="showNewAlbum" @close="showNewAlbum = false" @create="createAlbum" />

    <PhotoLightbox
      v-if="lightboxOpen && currentAlbum"
      :photos="photos"
      :index="photoIndex"
      :album="currentAlbum"
      :can-manage="canEdit"
      :paused="showConfirmation"
      @close="closePhoto"
      @go="goToPhoto"
      @share="sharePhoto"
      @download="downloadPhoto"
      @cover="useAsCover"
      @delete="confirmDeletePhoto"
    />

    <ConfirmationModal
      :show="showConfirmation"
      :title="confirmationConfig.title"
      :message="confirmationConfig.message"
      :confirm-text="confirmationConfig.confirmText"
      :cancel-text="confirmationConfig.cancelText"
      :confirm-button-class="confirmationConfig.confirmButtonClass"
      @update:show="showConfirmation = $event"
      @confirm="handleConfirmation"
      @cancel="showConfirmation = false"
    />
  </div>
</template>
