<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { 
  Search, 
  Link2, 
  Plus, 
  X, 
  MoreHorizontal, 
  ExternalLink, 
  Trash2, 
  Edit3, 
  Copy, 
  Check, 
  Globe, 
  Youtube, 
  Facebook, 
  FileText, 
  Video, 
  Clock, 
  Tag,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Info,
  ListFilter,
  Instagram,
  Palette,
  ArrowRight,
  Link
} from 'lucide-vue-next'
import { subscribeToLinks, addLink, updateLink, deleteLink } from '../api/linksService'

// State
const searchQuery = ref('')
const selectedCategory = ref('All')
const links = ref([])
const isLoading = ref(true)
const showFilterDropdown = ref(false)
const showActions = ref(null) // ID of link with open actions menu
const showDeleteModal = ref(false)
const linkToDelete = ref(null)
const showForm = ref(false)
const isEditing = ref(false)
const isSubmitting = ref(false)
const copySuccess = ref(null) // ID of link that was just copied

// Context Menu
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  link: null
})

// Form state
const initialForm = {
  title: '',
  url: '',
  category: 'Video',
  description: ''
}
const form = ref({ ...initialForm })

// Categories
const categories = ['All', 'Video', 'Social', 'Resource', 'Worship', 'Document', 'Official', 'Design']

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
  showActions.value = null
  contextMenu.value.show = false
  showFilterDropdown.value = false
}

const filteredLinks = computed(() => {
  return links.value.filter(link => {
    const matchesCategory = selectedCategory.value === 'All' || link.category === selectedCategory.value
    const matchesSearch = link.title.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
                          link.description?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                          link.url.toLowerCase().includes(searchQuery.value.toLowerCase())
    return matchesCategory && matchesSearch
  })
})

const getIcon = (url, category) => {
  const u = url.toLowerCase()
  if (u.includes('youtube.com') || u.includes('youtu.be')) return Youtube
  if (u.includes('facebook.com')) return Facebook
  if (u.includes('instagram.com')) return Instagram
  if (u.includes('canva.com')) return Palette
  if (u.includes('drive.google.com') || u.includes('docs.')) return FileText
  if (category === 'Video') return Video
  return Globe
}

const getCategoryColor = (category) => {
  const colors = {
    'Video': 'text-red-500 bg-red-50 dark:bg-red-900/10 border-transparent',
    'Social': 'text-blue-500 bg-blue-50 dark:bg-blue-900/10 border-transparent',
    'Resource': 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/10 border-transparent',
    'Worship': 'text-[#01779b] bg-[#01779b]/5 border-transparent',
    'Document': 'text-amber-500 bg-amber-50 dark:bg-amber-900/10 border-transparent',
    'Design': 'text-cyan-500 bg-cyan-50 dark:bg-cyan-900/10 border-transparent',
    'Official': 'text-purple-500 bg-purple-50 dark:bg-purple-900/10 border-transparent'
  }
  return colors[category] || 'text-gray-500 bg-gray-50 dark:bg-gray-800 border-transparent'
}

const handleAdd = () => {
  form.value = { ...initialForm }
  isEditing.value = false
  showForm.value = true
}

const handleEdit = (link) => {
  form.value = { ...link }
  isEditing.value = true
  showForm.value = true
}

const handleSubmit = async () => {
  if (!form.value.title || !form.value.url) return
  isSubmitting.value = true
  try {
    if (isEditing.value) {
      await updateLink(form.value.id, {
        title: form.value.title,
        url: form.value.url,
        category: form.value.category,
        description: form.value.description
      })
    } else {
      await addLink(form.value)
    }
    showForm.value = false
  } catch (err) { alert("Submission failed.") } finally { isSubmitting.value = false }
}

const handleDelete = (link) => {
  linkToDelete.value = link
  showDeleteModal.value = true
}

const confirmDelete = async () => {
  if (!linkToDelete.value) return
  isSubmitting.value = true
  try {
    await deleteLink(linkToDelete.value.id)
    showDeleteModal.value = false
    linkToDelete.value = null
  } catch (err) { alert("Delete failed.") } finally { isSubmitting.value = false }
}

const copyToClipboard = async (link) => {
  try {
    await navigator.clipboard.writeText(link.url)
    copySuccess.value = link.id
    setTimeout(() => { copySuccess.value = null }, 2000)
  } catch (err) { alert("Copy failed.") }
}

const openLink = (url) => { window.open(url, '_blank') }

const openLinkContext = (link, e) => {
  contextMenu.value = {
    show: true,
    x: e.clientX,
    y: e.clientY,
    link
  }
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden bg-white dark:bg-transparent">
    
    <!-- Action Bar -->
    <div class="flex-shrink-0 flex items-center gap-3 bg-white dark:bg-gray-900 py-3 w-full px-4 border-b border-gray-100 dark:border-gray-800 shadow-sm relative z-[40]">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input v-model="searchQuery" type="text" placeholder="Search archive..." class="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent text-sm transition-all" />
      </div>

      <div class="flex items-center gap-2">
        <div class="relative">
          <button @click.stop="showFilterDropdown = !showFilterDropdown" :class="[ 'p-2 rounded-lg transition-colors border', selectedCategory !== 'All' ? 'bg-[#01779b] text-white border-transparent' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white border-transparent hover:bg-gray-200' ]">
            <ListFilter class="h-5 w-5" />
          </button>
          
          <Transition name="fade">
            <div v-if="showFilterDropdown" class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 py-2 overflow-hidden">
              <button v-for="cat in categories" :key="cat" @click="selectedCategory = cat; showFilterDropdown = false" :class="[ 'w-full text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors block', selectedCategory === cat ? 'text-[#01779b] bg-[#01779b]/5' : 'text-gray-500 dark:text-gray-400' ]">{{ cat }}</button>
            </div>
          </Transition>
        </div>
        <button @click="handleAdd" class="px-6 py-2 rounded-lg bg-[#01779b] text-white hover:bg-[#015a77] transition-all font-black uppercase tracking-widest text-[10px] flex items-center gap-2 shadow-lg shadow-[#01779b]/20"><Plus class="h-4 w-4" /> Add New</button>
      </div>
    </div>

    <!-- Main Workspace -->
    <div class="flex-1 flex overflow-hidden min-h-0">
      
      <!-- List Area -->
      <div class="flex-1 h-full overflow-y-auto p-4 custom-scrollbar bg-white dark:bg-transparent">
        
        <!-- Loading State -->
        <div v-if="isLoading" class="space-y-1">
          <div v-for="i in 10" :key="i" class="h-16 bg-gray-50 dark:bg-gray-800/40 rounded-xl animate-pulse mx-2"></div>
        </div>

        <!-- Empty State -->
        <div v-else-if="filteredLinks.length === 0" class="flex flex-col items-center justify-center py-32 text-gray-400">
           <Link2 class="h-16 w-16 mb-4 opacity-5" /><p class="text-[13px] font-black uppercase tracking-widest">Archive empty</p>
        </div>

        <!-- Professional List View -->
        <div v-else class="space-y-1 max-w-6xl mx-auto">
          <!-- Table Header -->
          <div class="flex items-center px-6 py-2 mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 border-b border-gray-50 dark:border-gray-800">
            <div class="w-10">Icon</div>
            <div class="flex-1 ml-4">Resource Detail</div>
            <div class="w-32 hidden md:block">Category</div>
            <div class="w-24 text-right">Actions</div>
          </div>

          <div v-for="link in filteredLinks" :key="link.id" 
            @click="openLink(link.url)"
            @contextmenu.prevent="openLinkContext(link, $event)"
            class="group flex items-center px-6 py-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-white/5 border border-transparent hover:border-gray-100 dark:hover:border-gray-800 transition-all cursor-pointer relative"
            :class="{ 'opacity-80': contextMenu.show && contextMenu.link?.id === link.id }"
          >
            <!-- Start Column: Icon -->
            <div class="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-400 group-hover:text-[#01779b] dark:group-hover:text-[#22b8cf] transition-colors border border-gray-100 dark:border-gray-800">
              <component :is="getIcon(link.url, link.category)" class="h-5 w-5" />
            </div>

            <!-- Middle Column: Info -->
            <div class="flex-1 min-w-0 ml-4">
               <h3 class="font-bold text-gray-900 dark:text-white text-[14px] leading-tight flex items-center gap-2">
                 {{ link.title }}
                 <ExternalLink class="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />
               </h3>
               <p class="text-[11px] text-gray-400 font-medium truncate mt-0.5 opacity-80 decoration-gray-400/30 group-hover:underline">
                 {{ link.url }}
               </p>
            </div>

            <!-- Category Column -->
            <div class="w-32 hidden md:block">
               <span :class="['px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border', getCategoryColor(link.category)]">
                 {{ link.category }}
               </span>
            </div>

            <!-- End Column: Actions -->
            <div class="w-24 flex items-center justify-end gap-1">
               <button @click.stop="copyToClipboard(link)" class="p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 text-gray-400 hover:text-[#01779b] transition-all" title="Copy Path">
                  <Check v-if="copySuccess === link.id" class="h-4 w-4 text-green-500" />
                  <Copy v-else class="h-4 w-4" />
               </button>
               <button @click.stop="showActions = showActions === link.id ? null : link.id" class="p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all">
                  <MoreHorizontal class="h-4 w-4" />
               </button>

               <!-- Simple Popover -->
               <div v-if="showActions === link.id" class="absolute right-6 top-full mt-1 w-40 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl py-1 z-50 overflow-hidden" @click.stop>
                  <button @click="handleEdit(link); showActions = null" class="w-full px-4 py-2 flex items-center gap-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 text-[10px] font-black uppercase tracking-widest text-gray-700 dark:text-white transition-colors">
                    <Edit3 class="h-3.5 w-3.5 text-blue-500" /> Edit
                  </button>
                  <button @click="handleDelete(link); showActions = null" class="w-full px-4 py-2 flex items-center gap-2.5 hover:bg-red-50 dark:hover:bg-red-500/10 text-[10px] font-black uppercase tracking-widest text-red-500 transition-colors">
                    <Trash2 class="h-3.5 w-3.5" /> Delete
                  </button>
               </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Add/Edit Side Cabinet -->
      <Transition name="panel">
        <div v-if="showForm" 
          class="member-details-drawer m-3 rounded-2xl border-2 border-[#01779b]/30 dark:border-[#22b8cf]/30 bg-white dark:bg-gray-800 w-[calc(40%-1rem)] h-[calc(100%-1.5rem)] flex flex-col flex-shrink-0 shadow-xl shadow-[#01779b]/25 dark:shadow-[#22b8cf]/20 relative overflow-hidden z-[60]"
        >
          <div class="flex-shrink-0 bg-gradient-to-r from-[#01779b]/10 to-transparent dark:from-[#22b8cf]/10 dark:to-transparent border-b border-[#01779b]/20 dark:border-[#22b8cf]/20 px-6 py-4 flex items-center justify-between">
            <div>
              <h3 class="text-md font-bold text-gray-900 dark:text-white uppercase tracking-tight">{{ isEditing ? 'Edit Resource' : 'Archive New Link' }}</h3>
              <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 font-black uppercase tracking-widest">Metadata Entry</p>
            </div>
            <button @click="showForm = false" class="p-2 rounded-lg text-gray-400 hover:text-[#01779b] dark:hover:text-[#22b8cf] hover:bg-gray-100 dark:hover:bg-gray-700 transition-all group">
              <X class="h-5 w-5 transition-transform group-hover:rotate-90" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
            <section class="space-y-4">
              <div class="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-5 space-y-5 border border-gray-100 dark:border-gray-800">
                <div class="space-y-1.5 focus-within:text-[#01779b] transition-colors">
                  <label class="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Resource Label</label>
                  <input v-model="form.title" type="text" placeholder="e.g., Canva Slides (Worship)" class="w-full bg-transparent border-b-2 border-gray-200 dark:border-gray-700 py-1 text-sm font-bold text-gray-900 dark:text-white focus:border-[#01779b] outline-none transition-all" />
                </div>
                <div class="space-y-1.5 focus-within:text-[#01779b] transition-colors pt-2">
                  <label class="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Universal Link (URL)</label>
                  <input v-model="form.url" type="url" placeholder="https://..." class="w-full bg-transparent border-b-2 border-gray-200 dark:border-gray-700 py-1 text-sm font-bold text-[#01779b] dark:text-[#22b8cf] focus:border-[#01779b] outline-none transition-all" />
                </div>
                <!-- Host Detection Tag -->
                <div v-if="form.url" class="flex items-center gap-2 pt-2">
                   <div class="p-1 px-3 rounded-full bg-[#01779b]/10 text-[9px] font-black uppercase tracking-widest text-[#01779b] flex items-center gap-2">
                     <component :is="getIcon(form.url, form.category)" class="h-3 w-3" /> Source Verified
                   </div>
                </div>
              </div>
            </section>
            
            <section class="space-y-4">
              <div class="grid grid-cols-1 gap-4">
                  <div class="space-y-1.5">
                    <p class="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Classification</p>
                    <div class="grid grid-cols-2 gap-2">
                       <button v-for="cat in categories.slice(1)" :key="cat" @click="form.category = cat" :class="[ 'px-3 py-2.5 rounded-xl border-2 text-[8px] font-black uppercase tracking-widest transition-all', form.category === cat ? 'bg-[#01779b] border-[#01779b] text-white' : 'border-gray-100 dark:border-gray-700 text-gray-500 hover:border-[#01779b]/30' ]">{{ cat }}</button>
                    </div>
                  </div>
                </div>
            </section>

            <section class="space-y-4">
              <h4 class="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 ml-1">Notes</h4>
              <textarea v-model="form.description" rows="5" class="w-full bg-gray-50 dark:bg-gray-700/30 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 text-[11px] font-medium text-gray-600 dark:text-gray-300 outline-none focus:ring-2 focus:ring-[#01779b]/20" placeholder="Describe the resource contents..."></textarea>
            </section>
          </div>

          <div class="flex-shrink-0 bg-gradient-to-r from-[#01779b]/10 to-transparent dark:from-[#22b8cf]/10 dark:to-transparent border-t border-[#01779b]/20 dark:border-[#22b8cf]/20 px-6 py-5">
            <button @click="handleSubmit" :disabled="isSubmitting || !form.title || !form.url" class="group w-full py-4 bg-[#01779b] text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-[#01779b]/20 hover:bg-[#015a77] transition-all flex items-center justify-center gap-2">
              <Loader2 v-if="isSubmitting" class="h-4 w-4 animate-spin" />
              <span v-else>{{ isEditing ? 'Push Updates' : 'Archive resource' }}</span>
              <ArrowRight v-if="!isSubmitting" class="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Context Menu -->
    <Transition name="fade">
      <div v-if="contextMenu.show" 
        class="fixed z-[500] w-56 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl py-2 overflow-hidden animate-in"
        :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
        @click.stop
      >
        <div class="px-5 py-3 border-b border-gray-100 dark:border-gray-800 mb-1 flex items-center justify-between">
           <div class="min-w-0">
             <p class="text-[9px] font-black text-[#01779b] uppercase tracking-widest">{{ contextMenu.link.category }}</p>
             <p class="text-[12px] font-bold text-gray-900 dark:text-white truncate">{{ contextMenu.link.title }}</p>
           </div>
           <component :is="getIcon(contextMenu.link.url, contextMenu.link.category)" class="h-4 w-4 text-gray-400" />
        </div>
        <button @click="openLink(contextMenu.link.url); closeMenus()" class="w-full px-5 py-3 flex items-center gap-3 hover:bg-[#01779b]/10 text-[11px] font-black uppercase tracking-widest text-gray-700 dark:text-white transition-colors">
          <ExternalLink class="h-4 w-4 text-[#01779b]" /> Launch
        </button>
        <button @click="copyToClipboard(contextMenu.link); closeMenus()" class="w-full px-5 py-3 flex items-center gap-3 hover:bg-[#01779b]/10 text-[11px] font-black uppercase tracking-widest text-gray-700 dark:text-white transition-colors">
          <Copy class="h-4 w-4" /> Copy Path
        </button>
        <div class="h-px bg-gray-100 dark:bg-gray-800 my-1"></div>
        <button @click="handleEdit(contextMenu.link); closeMenus()" class="w-full px-5 py-3 flex items-center gap-3 hover:bg-[#01779b]/10 text-[11px] font-black uppercase tracking-widest text-[#01779b] transition-colors">
          <Edit3 class="h-4 w-4" /> Modify
        </button>
        <button @click="handleDelete(contextMenu.link); closeMenus()" class="w-full px-5 py-3 flex items-center gap-3 hover:bg-red-500/10 text-[11px] font-black uppercase tracking-widest text-red-500 transition-colors">
          <Trash2 class="h-4 w-4" /> Destroy
        </button>
      </div>
    </Transition>

    <!-- Confirm Delete Modal (Standard Premium) -->
    <Transition name="modal">
      <div v-if="showDeleteModal" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click="showDeleteModal = false">
        <div class="bg-white dark:bg-gray-800 w-full max-w-sm rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden transform transition-all" @click.stop>
          <div class="p-8 text-center">
            <div class="mx-auto w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-6">
              <AlertTriangle class="h-8 w-8 text-red-500" />
            </div>
            <h3 class="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">Delete Resource?</h3>
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 leading-relaxed mb-8 px-4 font-black uppercase tracking-widest opacity-60">"{{ linkToDelete?.title }}"</p>
            <div class="flex flex-col gap-3">
              <button @click="confirmDelete" :disabled="isSubmitting" class="w-full py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all flex items-center justify-center gap-2"><Loader2 v-if="isSubmitting" class="h-4 w-4 animate-spin" /><span v-else>Confirm Permanent Removal</span></button>
              <button @click="showDeleteModal = false" class="w-full py-4 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-200 transition-all">Keep Resource</button>
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

.animate-in { animation: animateIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes animateIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>
