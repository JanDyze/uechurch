<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, Image as ImageIcon, Plus, Maximize2, X, MapPin, Calendar, Clock, ChevronRight, ChevronLeft, ArrowLeft, Loader2, Upload, Download as DownloadIcon, ListFilter, Users, Info, Grid, Check, Trash2, Share2, AlertTriangle, MoreHorizontal, LogIn, ExternalLink } from 'lucide-vue-next'
import { subscribeToAlbums, uploadPhotoToBase64, addAlbum, subscribeToAlbumPhotos, setAlbumCover, deletePhoto, deleteAlbum } from '../api/galleryService'
import { subscribeToEvents } from '../api/eventsService'
import churchCover from '../assets/church.jpg'

const route = useRoute()
const router = useRouter()

const props = defineProps({
  id: String,
  view: String,
  photoId: String
})

// Categories for the gallery
const categories = ['All', 'Worship', 'Outreach', 'Fellowship', 'Special Events', 'Minutes Photos']
const selectedCategory = ref('All')
const searchQuery = ref('')
const selectedEvent = ref(null) 
const selectedImage = ref(null) 
const showFilterDropdown = ref(false)
const showDetails = ref(false) 
const showDeleteModal = ref(false)
const showMoreActions = ref(false)
const showAlbumActions = ref(false)
const showAlbumDeleteModal = ref(false)

// Context Menu state
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  album: null,
  photo: null
})

// Upload/Cover/Delete state
const fileInput = ref(null)
const isUploading = ref(false)
const isSettingCover = ref(false)
const isDeleting = ref(false)
const uploadProgress = ref('')

// Real data from Firebase
const manualAlbums = ref([])
const calendarEvents = ref([])
const albumPhotos = ref([]) 
const isLoading = ref(true)
const isPhotosLoading = ref(false) 

let unsubscribeAlbums = null
let unsubscribeEvents = null
let unsubscribePhotos = null

onMounted(() => {
  isLoading.value = true
  unsubscribeAlbums = subscribeToAlbums((data) => {
    manualAlbums.value = data
    checkLoading()
    syncSelectedEvent()
  })
  unsubscribeEvents = subscribeToEvents((data) => {
    calendarEvents.value = data
    checkLoading()
    syncSelectedEvent()
  })
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('click', closeContext)
})

const checkLoading = () => {
  if (manualAlbums.value.length >= 0 && calendarEvents.value.length >= 0) {
    isLoading.value = false
  }
}

const syncSelectedEvent = () => {
  const routeId = route.params.id
  if (routeId && routeId !== 'v') {
    const found = allAlbums.value.find(a => a.id === routeId)
    if (found) {
      selectedEvent.value = found
    }
  } else if (!showDetails.value) {
    selectedEvent.value = null
  }
}

// Watch for photoId in URL to open lightbox
watch([() => route.params.photoId, () => albumPhotos.value], ([newPhotoId, photos]) => {
  if (newPhotoId && photos.length > 0) {
    const found = photos.find(p => p.id === newPhotoId)
    if (found) {
      selectedImage.value = { 
        ...found, 
        ...selectedEvent.value, 
        albumId: selectedEvent.value?.id 
      }
    }
  } else if (!newPhotoId) {
    selectedImage.value = null
    showDeleteModal.value = false
    showMoreActions.value = false
  }
}, { immediate: true })

watch(() => route.params.id, (newId) => {
  if (newId && newId !== 'v') {
    syncSelectedEvent()
    showDetails.value = false
  } else if (!newId) {
    selectedEvent.value = null
  }
})

const subscribeToCurrentPhotos = (albumId) => {
  if (unsubscribePhotos) unsubscribePhotos()
  if (albumId && !albumId.startsWith('ev-')) {
    isPhotosLoading.value = true
    unsubscribePhotos = subscribeToAlbumPhotos(albumId, (photos) => {
      albumPhotos.value = photos
      isPhotosLoading.value = false
    })
  } else {
    albumPhotos.value = []
    isPhotosLoading.value = false
  }
}

watch(() => selectedEvent.value?.id, (newId) => {
  subscribeToCurrentPhotos(newId)
}, { immediate: true })

onUnmounted(() => {
  if (unsubscribeAlbums) unsubscribeAlbums()
  if (unsubscribeEvents) unsubscribeEvents()
  if (unsubscribePhotos) unsubscribePhotos()
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('click', closeContext)
})

const allAlbums = computed(() => {
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const pastEvents = calendarEvents.value
    .filter(ev => ev.date && new Date(ev.date) <= today)
    .map(ev => ({
      id: `ev-${ev.firestoreId || ev.id}`,
      calendarEventId: ev.firestoreId || ev.id,
      title: ev.title,
      description: ev.description || '',
      category: ev.type?.charAt(0).toUpperCase() + ev.type?.slice(1) || 'General',
      date: ev.date,
      location: ev.location || '',
      coverUrl: '',
      isCalendarEvent: true,
      existsInGallery: false
    }))
  const combined = [...pastEvents]
  manualAlbums.value.forEach(album => {
    const existingIndex = combined.findIndex(item => item.calendarEventId === album.calendarEventId || (item.title === album.title && item.date === album.date))
    if (existingIndex !== -1) combined[existingIndex] = { ...combined[existingIndex], ...album, existsInGallery: true }
    else combined.push({ ...album, isCalendarEvent: false, existsInGallery: true })
  })
  return combined.sort((a, b) => new Date(b.date) - new Date(a.date))
})

const filteredEvents = computed(() => {
  return allAlbums.value.filter(album => {
    const matchesCategory = selectedCategory.value === 'All' || album.category.toLowerCase() === selectedCategory.value.toLowerCase()
    const matchesSearch = album.title.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
                          album.category.toLowerCase().includes(searchQuery.value.toLowerCase())
    return matchesCategory && matchesSearch
  })
})

const groupedAlbums = computed(() => {
  const groups = {}
  filteredEvents.value.forEach(album => {
    if (!album.date) return
    const date = new Date(album.date)
    const key = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    if (!groups[key]) groups[key] = { label: key, timestamp: date.getTime(), albums: [] }
    groups[key].albums.push(album)
  })
  return Object.values(groups).sort((a, b) => b.timestamp - a.timestamp)
})

const openEvent = (event) => { 
  selectedEvent.value = event
  showDetails.value = true
}

const enterAlbum = () => {
  if (!selectedEvent.value) return
  showDetails.value = false
  router.push({ name: 'Gallery', params: { id: selectedEvent.value.id } })
}

const closeEvent = () => { router.push({ name: 'Gallery' }) }

const openImage = (image) => { 
  const albumId = selectedEvent.value?.id || 'all'
  router.push({ 
    name: 'Gallery', 
    params: { 
      id: albumId, 
      view: 'v', 
      photoId: image.id 
    } 
  })
}

const closeImage = () => { 
  if (selectedEvent.value) {
    router.push({ name: 'Gallery', params: { id: selectedEvent.value.id } })
  } else {
    router.push({ name: 'Gallery' })
  }
}

const openAlbumContext = (album, e) => {
  contextMenu.value = {
    show: true,
    x: e.clientX,
    y: e.clientY,
    album,
    photo: null
  }
}

const openPhotoContext = (photo, e) => {
  contextMenu.value = {
    show: true,
    x: e.clientX,
    y: e.clientY,
    album: selectedEvent.value,
    photo
  }
}

const closeContext = () => { contextMenu.value.show = false }

// Navigation in Lightbox (Update URLs)
const nextImage = (e) => {
  if (e) e.stopPropagation()
  if (!selectedImage.value || !albumPhotos.value.length) return
  const index = albumPhotos.value.findIndex(p => p.id === route.params.photoId)
  if (index !== -1 && index < albumPhotos.value.length - 1) {
    openImage(albumPhotos.value[index + 1])
  } else if (index === albumPhotos.value.length - 1) {
    openImage(albumPhotos.value[0])
  }
}

const prevImage = (e) => {
  if (e) e.stopPropagation()
  if (!selectedImage.value || !albumPhotos.value.length) return
  const index = albumPhotos.value.findIndex(p => p.id === route.params.photoId)
  if (index > 0) {
    openImage(albumPhotos.value[index - 1])
  } else if (index === 0) {
    openImage(albumPhotos.value[albumPhotos.value.length - 1])
  }
}

const handleKeydown = (e) => {
  if (showDeleteModal.value || showAlbumDeleteModal.value) {
    if (e.key === 'Escape') { showDeleteModal.value = false; showAlbumDeleteModal.value = false }
    if (e.key === 'Enter') { if(showDeleteModal.value) confirmDelete(); if(showAlbumDeleteModal.value) confirmAlbumDelete() }
    return
  }
  if (!selectedImage.value) return
  if (e.key === 'ArrowRight') nextImage()
  if (e.key === 'ArrowLeft') prevImage()
  if (e.key === 'Escape') closeImage()
}

const triggerUpload = () => { if (!selectedEvent.value) return; fileInput.value.click() }

const compressToThreshold = async (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let quality = 0.9, base64 = '', width = img.width, height = img.height
        const MAX_SIZE = 900 * 1024, MAX_DIM = 2000
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) { height *= MAX_DIM / width; width = MAX_DIM }
          else { width *= MAX_DIM / height; height = MAX_DIM }
        }
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height)
        do { base64 = canvas.toDataURL('image/webp', quality); quality -= 0.1 } while (base64.length > MAX_SIZE && quality > 0.1)
        resolve(base64)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

const handleFileUpload = async (event) => {
  const files = event.target.files
  if (!files.length) return
  isUploading.value = true
  try {
    let currentId = selectedEvent.value.id
    if (!selectedEvent.value.existsInGallery) {
      uploadProgress.value = 'Preparing album...'
      const newAlbumData = {
        title: selectedEvent.value.title,
        date: selectedEvent.value.date,
        category: selectedEvent.value.category,
        location: selectedEvent.value.location,
        calendarEventId: selectedEvent.value.calendarEventId,
        description: selectedEvent.value.description
      }
      currentId = await addAlbum(newAlbumData)
      router.replace({ name: 'Gallery', params: { id: currentId } })
    }
    for (let i = 0; i < files.length; i++) {
       uploadProgress.value = `Uploading ${i + 1}/${files.length}`
       const base64 = await compressToThreshold(files[i])
       await uploadPhotoToBase64(currentId, base64, '')
    }
    event.target.value = ''
  } catch (err) { alert("Upload failed."); console.error(err) } finally { isUploading.value = false; uploadProgress.value = '' }
}

const downloadPhoto = (targetContent = null) => {
  const photo = targetContent || selectedImage.value
  if (!photo) return
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.width; canvas.height = img.height
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0)
    const jpegData = canvas.toDataURL('image/jpeg', 0.95)
    const link = document.createElement('a')
    link.href = jpegData; link.download = `uec_photo_${Date.now()}.jpg`
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
  }
  img.src = photo.url
}

const handleSharePhoto = async (targetContent = null) => {
  const photo = targetContent || selectedImage.value
  if (!photo) return
  const albumId = selectedEvent.value?.id || 'all'
  const url = `${window.location.origin}/gallery/${albumId}/v/${photo.id}`
  const title = selectedEvent.value?.title || 'UEC Gallery'
  
  if (navigator.share) {
    try {
      await navigator.share({
        title,
        text: `From the UEC Gallery archive: ${title}`,
        url
      })
    } catch (err) { console.error('Share failed:', err) }
  } else {
    try {
      await navigator.clipboard.writeText(url)
      alert("Direct photo link copied to clipboard.")
    } catch (err) { alert("Copy failed.") }
  }
}

const updateCover = async (albumId = null, photoUrl = null) => {
  const aid = albumId || selectedEvent.value?.id
  const url = photoUrl || selectedImage.value?.url
  if (!aid || !url) return
  
  isSettingCover.value = true
  showMoreActions.value = false
  try {
    await setAlbumCover(aid, url)
    if (selectedEvent.value?.id === aid) {
       selectedEvent.value.coverUrl = url
    }
  } catch (err) { alert("Cover update failed."); console.error(err) } finally { isSettingCover.value = false }
}

const handleDeletePhoto = (targetContent = null) => {
  const photo = targetContent || selectedImage.value
  if (!photo?.id) return
  
  // If targeted from context menu, temporarily set as selected to reuse modal
  if (targetContent) selectedImage.value = targetContent

  showMoreActions.value = false
  showDeleteModal.value = true
}

const confirmDelete = async () => {
  if (!selectedImage.value?.id) return
  isDeleting.value = true
  try {
    await deletePhoto(selectedImage.value.id)
    showDeleteModal.value = false
    closeImage()
  } catch (err) {
    alert("Delete failed.")
    console.error(err)
  } finally {
    isDeleting.value = false
  }
}

const confirmAlbumDelete = async () => {
  const id = contextMenu.value.album?.id || selectedEvent.value?.id
  if (!id) return
  isDeleting.value = true
  try {
    await deleteAlbum(id)
    showAlbumDeleteModal.value = false
    showDetails.value = false
    selectedEvent.value = null
  } catch (err) { alert("Album delete failed."); console.error(err) } finally { isDeleting.value = false }
}

const cancelDelete = () => {
  showDeleteModal.value = false
  showAlbumDeleteModal.value = false
}

const formatDate = (dateStr) => {
  if (!dateStr) return 'No date'
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <input type="file" ref="fileInput" @change="handleFileUpload" accept="image/*" multiple class="hidden" />

    <!-- Action Bar -->
    <div class="flex-shrink-0 flex items-center gap-3 bg-white dark:bg-gray-900 py-2 w-full px-1">
      <button v-if="selectedEvent && !showDetails && route.params.id" @click="closeEvent" class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-[#01779b] hover:bg-[#01779b]/10 transition-colors">
        <ArrowLeft class="h-5 w-5" />
      </button>

      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input v-model="searchQuery" type="text" :placeholder="selectedEvent ? 'Search in album...' : 'Search albums...'" class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent text-sm transition-all" />
      </div>

      <div class="flex items-center gap-2">
        <div v-if="!selectedEvent || (selectedEvent && !route.params.id)" class="relative">
          <button @click="showFilterDropdown = !showFilterDropdown" :class="[ 'p-2 rounded-lg transition-colors border', selectedCategory !== 'All' ? 'bg-[#01779b] text-white border-transparent' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white border-transparent hover:bg-gray-200' ]" title="Filter by Category">
            <ListFilter class="h-5 w-5" />
          </button>
          <Transition name="fade"><div v-if="showFilterDropdown" @click="showFilterDropdown = false" class="fixed inset-0 z-40"></div></Transition>
          <Transition name="fade">
            <div v-if="showFilterDropdown" class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 py-2 overflow-hidden">
              <button v-for="cat in categories" :key="cat" @click="selectedCategory = cat; showFilterDropdown = false" :class="[ 'w-full text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors', selectedCategory === cat ? 'text-[#01779b] bg-[#01779b]/5' : 'text-gray-500 dark:text-gray-400' ]">{{ cat }}</button>
            </div>
          </Transition>
        </div>
        <button v-if="selectedEvent && route.params.id" @click="triggerUpload" :class="[ 'p-2 rounded-lg transition-all bg-[#01779b] text-white hover:bg-[#015a77]', isUploading ? 'opacity-50 cursor-not-allowed' : '' ]" :disabled="isUploading"><Loader2 v-if="isUploading" class="h-5 w-5 animate-spin" /><Upload v-else class="h-5 w-5" /></button>
      </div>
    </div>

    <!-- Main Workspace -->
    <div class="flex-1 flex overflow-hidden min-h-0 bg-transparent">
      
      <!-- List Area -->
      <div class="flex-1 h-full overflow-y-auto p-4 custom-scrollbar transition-all duration-300 scroll-smooth">
        <Transition name="fade">
          <div v-if="isUploading" class="sticky top-0 z-50 flex items-center justify-center p-4">
             <div class="bg-white dark:bg-gray-800 shadow-2xl rounded-full px-6 py-3 border border-gray-100 dark:border-gray-700 flex items-center gap-3">
               <Loader2 class="h-4 w-4 animate-spin text-[#01779b]" /><span class="text-[11px] font-black uppercase tracking-widest text-gray-900 dark:text-white">{{ uploadProgress || 'Processing...' }}</span>
             </div>
          </div>
        </Transition>

        <!-- Gallery Grid -->
        <div v-if="isLoading && !route.params.id" class="space-y-10">
          <div v-for="i in 2" :key="i" class="space-y-6">
            <div class="flex items-center gap-4 py-2 animate-pulse"><div class="w-32 h-6 bg-gray-200 dark:bg-gray-800 rounded-lg"></div><div class="flex-1 h-px bg-gray-100 dark:bg-gray-800"></div></div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6"><div v-for="j in 5" :key="j" class="bg-white dark:bg-gray-800 rounded-[2rem] overflow-hidden border border-gray-100 dark:border-gray-700 animate-pulse"><div class="aspect-[4/3] bg-gray-100 dark:bg-gray-900"></div><div class="p-5 space-y-3"><div class="w-12 h-2 bg-gray-100 dark:bg-gray-800 rounded"></div><div class="w-full h-4 bg-gray-100 dark:bg-gray-800 rounded"></div></div></div></div>
          </div>
        </div>

        <template v-else-if="!route.params.id">
          <div v-if="groupedAlbums.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-500"><ImageIcon class="h-16 w-16 mb-4 opacity-5" /><p class="text-xl font-medium tracking-tight">Album Empty</p></div>
          <div v-for="group in groupedAlbums" :key="group.label" class="mb-10">
            <div class="flex items-center gap-4 mb-4 sticky top-0 bg-white/90 dark:bg-gray-900/90 py-2 z-10 backdrop-blur-md">
              <h2 class="text-[13px] font-black text-gray-900 dark:text-white tracking-widest uppercase">{{ group.label }}</h2>
              <div class="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
            </div>
            
            <div class="grid gap-4 transform-gpu transition-all duration-300" 
              :class="[
                showDetails 
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
              ]"
            >
              <div v-for="album in group.albums" :key="album.id" 
                @click="openEvent(album)" 
                @contextmenu.prevent="openAlbumContext(album, $event)"
                class="group relative bg-white dark:bg-gray-800 rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-700 transition-all cursor-pointer aspect-square"
                :class="{ 
                  'border-[#01779b] ring-2 ring-[#01779b]/10 bg-gray-50 dark:bg-gray-700/30': selectedEvent?.id === album.id && showDetails,
                  'opacity-80 scale-[0.98]': contextMenu.show && contextMenu.album?.id === album.id
                }"
              >
                <!-- Full-size Image Background -->
                <div class="absolute inset-0 overflow-hidden">
                  <img :src="album.coverUrl || churchCover" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  
                  <!-- Gradient Overlay -->
                  <div class="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent"></div>
                  
                  <div v-if="!album.existsInGallery" class="absolute top-4 left-4">
                    <p class="text-[8px] text-[#01779b] dark:text-[#22b8cf] font-black uppercase tracking-widest bg-white/90 dark:bg-black/40 px-3 py-1.5 rounded-full border border-white/20 shadow-sm backdrop-blur-sm">No photos yet</p>
                  </div>
                </div>

                <!-- Text Container (Overlayed) -->
                <div class="absolute bottom-0 inset-x-0 p-5 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/40 to-transparent h-1/2">
                   <div class="flex items-center justify-between mb-1 text-[8px] font-black uppercase tracking-[0.2em] text-white/70">
                    <span class="truncate truncate max-w-[120px]">{{ album.category }}</span>
                    <span>{{ formatDate(album.date).split(',')[1] }}</span>
                  </div>
                  <h3 class="text-sm font-bold text-white group-hover:text-[#22b8cf] transition-colors line-clamp-2 leading-snug tracking-tight mb-1">{{ album.title }}</h3>
                  <div class="w-8 h-1 bg-[#01779b] rounded-full group-hover:w-full transition-all duration-500"></div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <!-- List View Inside Album -->
          <div v-if="isPhotosLoading" class="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-3 space-y-3">
            <div v-for="i in 8" :key="i" class="break-inside-avoid relative overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" :style="{ height: [200, 300, 150, 400][i % 4] + 'px' }"></div>
          </div>
          <div v-else-if="albumPhotos.length === 0" class="flex flex-col items-center justify-center py-24 text-gray-500">
            <ImageIcon class="h-16 w-16 mb-4 opacity-10" /><h3 class="text-lg font-bold">This album is empty</h3>
            <p class="text-[11px] mt-1 max-w-xs text-center font-black uppercase tracking-widest opacity-40">Add photos to this album.</p>
            <button @click="triggerUpload" :disabled="isUploading" class="mt-8 px-8 py-3 bg-[#01779b] text-white rounded-xl flex items-center gap-2 font-black uppercase tracking-widest text-[10px] transition-all"><Upload class="h-4 w-4" /><span>Add Photo</span></button>
          </div>
          <div v-else class="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-3 space-y-3">
            <div v-for="photo in albumPhotos" :key="photo.id" 
              @click="openImage(photo)" 
              @contextmenu.prevent="openPhotoContext(photo, $event)"
              class="break-inside-avoid relative group overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 cursor-zoom-in transition-all"
              :class="{ 'opacity-80 scale-[0.98]': contextMenu.show && contextMenu.photo?.id === photo.id }"
            >
              <img :src="photo.url" class="w-full h-auto transition-transform duration-500 group-hover:scale-105" />
              <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4"><p class="text-white text-[10px] font-black tracking-widest uppercase">Photo View</p></div>
            </div>
          </div>
        </template>
      </div>

      <!-- Panel Flow Sibling -->
      <Transition name="panel">
        <div v-if="showDetails && selectedEvent" 
          class="member-details-drawer m-3 rounded-2xl border-2 border-[#01779b]/30 dark:border-[#22b8cf]/30 bg-white dark:bg-gray-800 w-[calc(40%-1rem)] h-[calc(100%-1.5rem)] flex flex-col flex-shrink-0 shadow-xl shadow-[#01779b]/25 dark:shadow-[#22b8cf]/20 relative overflow-hidden"
        >
          <!-- Header -->
          <div class="flex-shrink-0 bg-gradient-to-r from-[#01779b]/10 to-transparent dark:from-[#22b8cf]/10 dark:to-transparent border-b border-[#01779b]/20 dark:border-[#22b8cf]/20 px-6 py-4 flex items-center justify-between">
            <div>
              <h3 class="text-md font-bold text-gray-900 dark:text-white uppercase tracking-tight">Album Details</h3>
              <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 font-black uppercase tracking-widest">{{ selectedEvent.category }} Archive</p>
            </div>
            <button @click="showDetails = false" class="p-2 rounded-lg text-gray-400 hover:text-[#01779b] dark:hover:text-[#22b8cf] hover:bg-gray-100 dark:hover:bg-gray-700 transition-all group">
              <X class="h-5 w-5 transition-transform group-hover:rotate-90" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
            <!-- Info Section -->
            <section class="space-y-3">
              <h4 class="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <Info class="h-3.5 w-3.5" /> Information
              </h4>
              <div class="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 space-y-4 border border-gray-100 dark:border-gray-800">
                <div class="grid grid-cols-2 gap-4">
                  <div class="space-y-1">
                    <p class="text-[8px] font-black uppercase tracking-widest text-[#01779b]/60">Date Taken</p>
                    <p class="text-xs font-bold text-gray-900 dark:text-white leading-tight">{{ formatDate(selectedEvent.date) }}</p>
                  </div>
                  <div class="space-y-1">
                    <p class="text-[8px] font-black uppercase tracking-widest text-[#01779b]/60">Location</p>
                    <p class="text-xs font-bold text-gray-900 dark:text-white leading-tight truncate">{{ selectedEvent.location || 'N/A' }}</p>
                  </div>
                </div>
                <div class="pt-3 border-t border-gray-100 dark:border-gray-700">
                    <p class="text-[8px] font-black uppercase tracking-widest text-[#01779b]/60 mb-1">Title</p>
                    <h2 class="text-md font-black text-gray-900 dark:text-white leading-snug">{{ selectedEvent.title }}</h2>
                </div>
                <div v-if="selectedEvent.description" class="pt-3 border-t border-gray-100 dark:border-gray-700">
                    <p class="text-[8px] font-black uppercase tracking-widest text-[#01779b]/60 mb-1">Description</p>
                    <p class="text-[11px] text-gray-500 dark:text-gray-400 font-medium leading-relaxed">{{ selectedEvent.description }}</p>
                </div>
              </div>
            </section>

            <!-- Previews -->
            <section class="space-y-3">
               <h4 class="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <Grid class="h-3.5 w-3.5" /> Photos
              </h4>
               <div v-if="isPhotosLoading" class="grid grid-cols-3 gap-2"><div v-for="i in 6" :key="i" class="aspect-square bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div></div>
               <div v-else-if="albumPhotos.length" class="grid grid-cols-3 gap-2"><div v-for="photo in albumPhotos.slice(0, 9)" :key="photo.id" @click="openImage(photo)" class="aspect-square rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700 bg-white shadow-sm hover:shadow-md transition-shadow cursor-zoom-in"><img :src="photo.url" class="w-full h-full object-cover" /></div><div v-if="albumPhotos.length > 9" class="aspect-square rounded-xl bg-[#01779b]/5 border border-dashed border-[#01779b]/20 flex items-center justify-center"><p class="text-sm font-black text-[#01779b]">+{{ albumPhotos.length - 9 }}</p></div></div>
               <div v-else class="py-12 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl flex flex-col items-center justify-center text-gray-300"><ImageIcon class="h-8 w-8 mb-3 opacity-20" /><p class="text-[8px] font-black uppercase tracking-widest opacity-40">No photos</p></div>
            </section>
          </div>

          <!-- Panel Footer Actions -->
          <div class="flex-shrink-0 bg-gradient-to-r from-[#01779b]/10 to-transparent dark:from-[#22b8cf]/10 dark:to-transparent border-t border-[#01779b]/20 dark:border-[#22b8cf]/20 px-6 py-4">
            <div class="flex items-center gap-2 relative">
               <!-- Major: Enter -->
              <button @click="enterAlbum" class="flex-1 py-3 bg-[#01779b] text-white rounded-xl font-black uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-[#01779b]/20 hover:bg-[#015a77] hover:shadow-xl transition-all flex items-center justify-center gap-2 group">
                Enter Album <ChevronRight class="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>

              <!-- Album More Actions -->
              <div v-if="selectedEvent.existsInGallery" class="relative group">
                <button @click="showAlbumActions = !showAlbumActions" class="px-4 py-3 bg-white/50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors" title="Album Actions">
                   <MoreHorizontal class="h-4 w-4" />
                </button>

                <Transition name="fade">
                  <div v-if="showAlbumActions" class="absolute bottom-full right-0 mb-3 w-48 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden py-1.5 z-[120]">
                    <button 
                      @click="showAlbumDeleteModal = true; showAlbumActions = false" 
                      class="w-full px-4 py-3 flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-[10px] font-black uppercase tracking-widest text-red-500"
                    >
                      <Trash2 class="h-3.5 w-3.5" />
                      <span>Delete Album</span>
                    </button>
                  </div>
                </Transition>
                <div v-if="showAlbumActions" @click="showAlbumActions = false" class="fixed inset-0 z-[115]"></div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Context Menu Portal -->
    <Transition name="fade">
      <div v-if="contextMenu.show" 
        class="fixed z-[500] w-56 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl py-2 overflow-hidden animate-in fade-in zoom-in duration-200"
        :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
        @click.stop
      >
        <!-- Album Context -->
        <template v-if="contextMenu.album && !contextMenu.photo">
          <div class="px-4 py-2 border-b border-gray-100 dark:border-gray-800 mb-1">
            <p class="text-[8px] font-black text-gray-400 uppercase tracking-widest">Album Actions</p>
            <p class="text-[11px] font-bold text-gray-900 dark:text-white truncate">{{ contextMenu.album.title }}</p>
          </div>
          <button @click="openEvent(contextMenu.album); closeContext()" class="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#01779b]/10 dark:hover:bg-[#22b8cf]/10 text-[10px] font-black uppercase tracking-widest text-gray-700 dark:text-white transition-colors">
            <Info class="h-3.5 w-3.5 text-[#01779b]" /> <span>View Details</span>
          </button>
          <button @click="selectedEvent = contextMenu.album; enterAlbum(); closeContext()" class="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#01779b]/10 dark:hover:bg-[#22b8cf]/10 text-[10px] font-black uppercase tracking-widest text-gray-700 dark:text-white transition-colors">
            <LogIn class="h-3.5 w-3.5 text-[#01779b]" /> <span>Enter Album</span>
          </button>
          <template v-if="contextMenu.album.existsInGallery">
            <div class="h-px bg-gray-100 dark:bg-gray-800 my-1"></div>
            <button @click="showAlbumDeleteModal = true; closeContext()" class="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-red-500/10 text-[10px] font-black uppercase tracking-widest text-red-500 transition-colors">
              <Trash2 class="h-3.5 w-3.5" /> <span>Delete Album</span>
            </button>
          </template>
        </template>

        <!-- Photo Context -->
        <template v-else-if="contextMenu.photo">
          <div class="px-4 py-2 border-b border-gray-100 dark:border-gray-800 mb-1">
            <p class="text-[8px] font-black text-gray-400 uppercase tracking-widest">Photo Actions</p>
            <p class="text-[11px] font-bold text-gray-900 dark:text-white">Quick Access</p>
          </div>
          <button @click="openImage(contextMenu.photo); closeContext()" class="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#01779b]/10 text-[10px] font-black uppercase tracking-widest text-gray-700 dark:text-white transition-colors">
            <Maximize2 class="h-3.5 w-3.5 text-[#01779b]" /> <span>Expand View</span>
          </button>
          <button @click="handleSharePhoto(contextMenu.photo); closeContext()" class="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#01779b]/10 text-[10px] font-black uppercase tracking-widest text-[#01779b] transition-colors">
            <Share2 class="h-3.5 w-3.5" /> <span>Copy Link</span>
          </button>
          <button @click="downloadPhoto(contextMenu.photo); closeContext()" class="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#01779b]/10 text-[10px] font-black uppercase tracking-widest text-gray-700 dark:text-white transition-colors">
            <DownloadIcon class="h-3.5 w-3.5" /> <span>Download JPEG</span>
          </button>
          <div class="h-px bg-gray-100 dark:bg-gray-800 my-1"></div>
          <button @click="updateCover(null, contextMenu.photo.url); closeContext()" class="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[#01779b]/10 text-[10px] font-black uppercase tracking-widest text-gray-700 dark:text-white transition-colors">
            <Check class="h-3.5 w-3.5 text-green-500" /> <span>Set as Cover</span>
          </button>
          <button @click="handleDeletePhoto(contextMenu.photo); closeContext()" class="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-red-500/10 text-[10px] font-black uppercase tracking-widest text-red-500 transition-colors">
            <Trash2 class="h-3.5 w-3.5" /> <span>Delete Photo</span>
          </button>
        </template>
      </div>
    </Transition>

    <!-- Lightbox -->
    <Transition name="modal">
      <div v-if="selectedImage" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 md:p-10" @click="closeImage">
        
        <!-- Navigation Arrows -->
        <button @click="nextImage" class="fixed right-4 md:right-8 top-1/2 -translate-y-1/2 z-[110] p-4 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all backdrop-blur-md group">
          <ChevronRight class="h-8 w-8 transition-transform group-hover:translate-x-1" />
        </button>
        <button @click="prevImage" class="fixed left-4 md:left-8 top-1/2 -translate-y-1/2 z-[110] p-4 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all backdrop-blur-md group">
          <ChevronLeft class="h-8 w-8 transition-transform group-hover:-translate-x-1" />
        </button>

        <button @click="closeImage" class="absolute top-6 right-6 p-4 text-white/50 hover:text-white transition-colors z-[110]"><X class="h-8 w-8" /></button>
        
        <div class="max-w-7xl w-full h-full flex flex-col md:flex-row items-center gap-8 relative" @click.stop>
          <div class="flex-1 h-full flex items-center justify-center relative">
            <Transition name="fade" mode="out-in">
              <img :key="selectedImage.url" :src="selectedImage.url" class="max-h-full max-w-full rounded-xl object-contain shadow-2xl border border-white/5" />
            </Transition>
          </div>
          <div class="w-full md:w-80 flex-shrink-0 text-white space-y-6">
            <div><span class="px-3 py-1 rounded-full bg-[#01779b]/20 border border-[#01779b]/50 text-[#22b8cf] text-[10px] font-black uppercase tracking-wider mb-3 block w-fit">{{ selectedImage.category }}</span><h2 class="text-2xl font-black leading-tight">{{ selectedEvent.title }}</h2></div>
            <p class="text-white/70 leading-relaxed text-[11px] font-medium opacity-60">{{ selectedImage.description || 'Photo view.' }}</p>
            <div class="space-y-4 pt-4 border-t border-white/10 text-[10px] tracking-widest font-black uppercase">
              <div class="flex items-center gap-3"><Calendar class="h-3.5 w-3.5 text-[#22b8cf]" /><span>{{ selectedEvent.date ? new Date(selectedEvent.date).toLocaleDateString(undefined, { dateStyle: 'full' }) : 'No date' }}</span></div>
              <div class="flex items-center gap-3"><MapPin class="h-3.5 w-3.5 text-[#22b8cf]" /><span>{{ selectedEvent.location || 'Church Campus' }}</span></div>
            </div>
            
            <!-- Minimal Action Row -->
            <div class="flex items-center gap-2 mt-auto pt-6 px-1 relative">
              <!-- Major Actions -->
              <button @click="handleSharePhoto()" class="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 transition-all rounded-xl flex items-center justify-center group text-blue-400" title="Share Photo Link">
                <Share2 class="h-4 w-4 transition-transform group-hover:scale-110" />
              </button>

              <button @click="downloadPhoto()" class="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 transition-all rounded-xl flex items-center justify-center group" title="Download JPEG">
                <DownloadIcon class="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
              </button>

              <!-- More Actions Toggle -->
              <div class="relative flex-1">
                <button @click="showMoreActions = !showMoreActions" class="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 transition-all rounded-xl flex items-center justify-center group" title="More Actions">
                  <MoreHorizontal class="h-4 w-4 transition-transform group-hover:scale-110" />
                </button>
                
                <!-- More Actions Menu -->
                <Transition name="fade">
                  <div v-if="showMoreActions" class="absolute bottom-full right-0 mb-3 w-48 bg-gray-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-1.5 z-[120]">
                    <button 
                      @click="updateCover()" 
                      :disabled="isSettingCover || selectedEvent.coverUrl === selectedImage.url"
                      class="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-[10px] font-black uppercase tracking-widest text-white/80 disabled:opacity-30"
                    >
                      <ImageIcon class="h-3.5 w-3.5" />
                      <span>Set as Cover</span>
                    </button>
                    <div class="h-px bg-white/5 mx-3"></div>
                    <button 
                      @click="handleDeletePhoto()"
                      class="w-full px-4 py-3 flex items-center gap-3 hover:bg-red-500/10 transition-colors text-[10px] font-black uppercase tracking-widest text-red-500"
                    >
                      <Trash2 class="h-3.5 w-3.5" />
                      <span>Delete Photo</span>
                    </button>
                  </div>
                </Transition>
                <div v-if="showMoreActions" @click="showMoreActions = false" class="fixed inset-0 z-[115]"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Custom Delete Modal -->
    <Transition name="modal">
      <div v-if="showDeleteModal || showAlbumDeleteModal" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click="cancelDelete">
        <div class="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden transform transition-all" @click.stop>
          <div class="p-8 text-center">
            <div class="mx-auto w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-6">
              <AlertTriangle class="h-8 w-8 text-red-500" />
            </div>
            <h3 class="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">Delete {{ showAlbumDeleteModal ? 'Album' : 'Photo' }}?</h3>
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 leading-relaxed mb-8 px-4">
              This {{ showAlbumDeleteModal ? 'entire album and all its photos' : 'photo' }} will be permanently removed. This action cannot be undone.
            </p>
            
            <div class="flex flex-col gap-3">
              <button 
                @click="showAlbumDeleteModal ? confirmAlbumDelete() : confirmDelete()" 
                :disabled="isDeleting"
                class="w-full py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-red-500/20 hover:bg-red-600 hover:shadow-xl transition-all flex items-center justify-center gap-2"
              >
                <Loader2 v-if="isDeleting" class="h-4 w-4 animate-spin" />
                <span v-else>Confirm Delete</span>
              </button>
              <button 
                @click="cancelDelete" 
                class="w-full py-4 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(1, 119, 155, 0.2); border-radius: 10px; }
.modal-enter-active, .modal-leave-active { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.modal-enter-from, .modal-leave-to { opacity: 0; transform: scale(0.95); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.member-details-drawer {
  transition: max-width 0.3s ease-out, opacity 0.3s ease;
}

.panel-enter-from, .panel-leave-to {
  max-width: 0 !important;
  opacity: 0;
  margin-left: 0 !important;
  margin-right: 0 !important;
}

.break-inside-avoid { break-inside: avoid; }
.transform-gpu { transform: translate3d(0,0,0); }

/* Context Menu Animations */
.animate-in { animation: animateIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes animateIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>
