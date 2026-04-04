<script setup>
import { ref, computed } from "vue";
import { useRoute } from "vue-router";
import { Bell, Sun, Moon, X, Users } from "lucide-vue-next";
import { useTheme } from "../composables/useTheme";
import logo from "../assets/uec-logo.png";

const route = useRoute();
const { isDark, toggleTheme } = useTheme();
const isMenuOpen = ref(false);

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;
};

const pageTitle = computed(() => {
  const routeNames = {
    Home: 'Dashboard',
    Members: 'Members',
    Events: 'Events',
    Finances: 'Finances',
    Gallery: 'Gallery',
    Links: 'Links'
  };
  return routeNames[route.name] || 'Dashboard';
});

// Biblical Characters Presence simulation
const roles = [
  { name: 'Arkbuilder Noah', bg: 'bg-blue-600', color: 'text-white' },
  { name: 'Good Samaritan', bg: 'bg-emerald-500', color: 'text-white' },
  { name: 'Saved by Grace', bg: 'bg-pink-500', color: 'text-white' },
  { name: 'Brave Esther', bg: 'bg-purple-600', color: 'text-white' },
  { name: 'Faithful Ruth', bg: 'bg-amber-600', color: 'text-white' },
  { name: 'Fisher of Men', bg: 'bg-cyan-500', color: 'text-white' },
  { name: 'Pillar of Fire', bg: 'bg-orange-600', color: 'text-white' },
  { name: 'Light of World', bg: 'bg-yellow-400', color: 'text-yellow-900' },
  { name: 'Lost Sheep', bg: 'bg-stone-500', color: 'text-white' },
  { name: 'Shepherd David', bg: 'bg-green-600', color: 'text-white' },
  { name: 'Mighty Samson', bg: 'bg-red-600', color: 'text-white' },
  { name: 'Living Water', bg: 'bg-sky-400', color: 'text-white' },
]

const visitors = ref([])
const mySessionId = ref('')
const myAnimal = ref(null)

import { onMounted, onUnmounted } from 'vue'
import { updatePresence, subscribeToPresence, removePresence } from '../api/presenceService'

onMounted(async () => {
  // PERSISTENCE: Check if we have a session in this browser already
  let sid = localStorage.getItem('uec_visitor_session_id')
  let anim = localStorage.getItem('uec_visitor_animal')

  if (!sid) {
    sid = `session-${Math.random().toString(36).substring(2, 11)}`
    localStorage.setItem('uec_visitor_session_id', sid)
  }

  if (!anim) {
    // Pick from roles that are not already active to avoid duplicates
    const activeNames = visitors.value.map(v => v.name)
    const availableRoles = roles.filter(r => !activeNames.includes(r.name))
    
    // If all roles are taken, fallback to full list
    const pool = availableRoles.length > 0 ? availableRoles : roles
    const randomRole = pool[Math.floor(Math.random() * pool.length)]
    
    anim = JSON.stringify(randomRole)
    localStorage.setItem('uec_visitor_animal', anim)
  }

  mySessionId.value = sid
  myAnimal.value = JSON.parse(anim)

  // Initial heartbeat
  await updatePresence(mySessionId.value, myAnimal.value)

  // Start periodic heartbeat every 30 seconds
  const heartbeatInterval = setInterval(() => {
    updatePresence(mySessionId.value, myAnimal.value)
  }, 30000)

  // Cleanup on Tab Close
  const handleUnload = () => {
    removePresence(mySessionId.value)
  }
  window.addEventListener('beforeunload', handleUnload)

  // Subscribe to all live visitors
  const unsubscribePresence = subscribeToPresence((data) => {
    // Filter out our own session so we only see 'others'
    visitors.value = data.filter(v => v.id !== mySessionId.value)
  })

  onUnmounted(async () => {
    clearInterval(heartbeatInterval)
    unsubscribePresence()
    window.removeEventListener('beforeunload', handleUnload)
    await removePresence(mySessionId.value)
  })
})

const isModalOpen = ref(false)
const isRenaming = ref(false)
const newName = ref('')

const startRename = () => {
  newName.value = myAnimal.value.name
  isRenaming.value = true
}

const toggleRename = () => {
  if (isRenaming.value) {
    isRenaming.value = false
  } else {
    startRename()
  }
}

const saveName = async () => {
  if (!newName.value) { isRenaming.value = false; return }
  
  const updatedAnimal = { 
    ...myAnimal.value, 
    name: newName.value 
  }
  
  myAnimal.value = updatedAnimal
  localStorage.setItem('uec_visitor_animal', JSON.stringify(updatedAnimal))
  await updatePresence(mySessionId.value, updatedAnimal)
  isRenaming.value = false
}
</script>

<template>
  <header class="bg-white dark:bg-gray-800 sticky top-0 z-[70]">
    <div class="px-4 sm:px-6 lg:px-4">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center gap-3">
          <div>
            <div class="text-xl font-bold text-[#01779b] dark:text-[#22b8cf]">
              {{ pageTitle }}
            </div>
          </div>
        </div>
        <!-- Right: User menu and notifications -->
        <div class="flex items-center gap-2">
          <!-- Anonymous Visitors Stack -->
          <div v-if="visitors.length || myAnimal" class="flex items-center -space-x-1.5 mr-3 animate-in fade-in slide-in-from-right-4 duration-700 delay-300">
            <!-- Current User (YOU) with Rename Popup -->
            <div v-if="myAnimal" class="relative group">
              <div @click.stop="toggleRename" 
                class="w-7.5 h-7.5 rounded-full border-2 border-[#01779b] dark:border-[#22b8cf] flex items-center justify-center cursor-pointer relative z-40 shadow-xl hover:scale-110 hover:rotate-12 active:scale-95 transition-all bg-white dark:bg-gray-800"
              >
                  <div class="w-full h-full overflow-hidden rounded-full">
                    <img :src="`https://api.dicebear.com/9.x/open-peeps/svg?seed=${mySessionId}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`" class="w-full h-full object-cover" />
                  </div>
                  <div class="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover:block bg-[#01779b] text-white text-[9px] px-2 py-1.5 rounded-lg whitespace-nowrap shadow-2xl z-50 uppercase tracking-widest font-black pointer-events-none">
                      {{ myAnimal.name }} (YOU)
                  </div>
              </div>
              
              <!-- Rename Popover -->
              <Transition name="fade">
                <div v-if="isRenaming" class="absolute top-full right-0 mt-3 w-56 bg-white dark:bg-gray-900 border-2 border-[#01779b]/20 dark:border-[#22b8cf]/20 rounded-2xl shadow-2xl p-4 z-[100]" @click.stop>
                  <div class="flex items-center justify-between mb-3">
                    <p class="text-[9px] font-black uppercase tracking-widest text-[#01779b]">Identity Setup</p>
                    <button @click="isRenaming = false" class="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors">
                      <X class="w-3 h-3" />
                    </button>
                  </div>
                  <div class="flex flex-col gap-2.5">
                    <div class="relative">
                      <span class="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] font-black">@</span>
                      <input v-model="newName" class="w-full bg-transparent border-b-2 border-gray-100 dark:border-gray-800 pl-4 py-1.5 text-[11px] font-black text-gray-900 dark:text-white outline-none focus:border-[#01779b] transition-colors" @keyup.enter="saveName" placeholder="Enter name..." autofocus />
                    </div>
                    <div class="flex gap-2">
                       <button @click="isRenaming = false" class="flex-1 py-2.5 border-2 border-gray-100 dark:border-gray-800 text-gray-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">Cancel</button>
                       <button @click="saveName" class="flex-[1.5] py-2.5 bg-[#01779b] text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-[#015a77] transition-all shadow-lg shadow-[#01779b]/20 active:scale-95">Update</button>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>

            <!-- Other Active Sessions (Max 5 shown) -->
            <div v-for="v in visitors.slice(0, 5)" :key="v.id" 
              class="w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center cursor-help relative group shadow-sm hover:z-20 hover:-translate-y-0.5 transition-all opacity-80 hover:opacity-100 bg-white dark:bg-gray-800"
            >
               <div class="w-full h-full overflow-hidden rounded-full font-black">
                 <img :src="`https://api.dicebear.com/9.x/open-peeps/svg?seed=${v.id}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`" class="w-full h-full object-cover" />
               </div>
               <div class="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover:block bg-gray-900 text-white text-[9px] px-2 py-1.5 rounded-lg whitespace-nowrap shadow-2xl z-50 uppercase tracking-widest font-black pointer-events-none">
                  {{ v.name }}
               </div>
            </div>

            <!-- Overflow indicator -->
            <div v-if="visitors.length > 5" 
              @click="isModalOpen = true"
              class="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-white dark:border-gray-700 flex items-center justify-center text-[9px] font-black text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-200 transition-all relative z-10"
            >
              +{{ visitors.length - 5 }}
            </div>
          </div>

          <!-- Theme Toggle -->
          <button
            @click="toggleTheme($event)"
            class="p-2 rounded-full text-[#01779b] dark:text-[#22b8cf] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <Sun v-if="isDark" class="w-5 h-5" />
            <Moon v-else class="w-5 h-5" />
          </button>

          <!-- Notifications -->
          <button
            class="p-2 rounded-full text-[#01779b] dark:text-[#22b8cf] hover:bg-gray-100 dark:hover:bg-gray-700 relative"
          >
            <Bell class="w-6 h-6" />
            <span
              class="absolute top-1 right-1 w-2 h-2 bg-[#bc1c09] rounded-full"
            ></span>
          </button>

          <!-- User profile (using online mock avatar API) -->
          <button
            class="flex items-center gap-2 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <img
              src="https://api.dicebear.com/9.x/dylan/svg?seed=UEC"
              alt="User Avatar"
              class="w-8 h-8 rounded-full object-cover"
            />
          </button>
          
        </div>
      </div>
    </div>

    <!-- Active Visitors Modal -->
    <Transition name="fade">
      <div v-if="isModalOpen" class="fixed inset-0 z-[110] flex items-center justify-center bg-gray-900/40 backdrop-blur-md" @click="isModalOpen = false">
        <div class="w-full max-w-sm bg-white dark:bg-gray-900 rounded-[32px] shadow-2xl border-4 border-white dark:border-gray-800 p-8 m-4 max-h-[80vh] flex flex-col" @click.stop>
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-3">
              <div class="p-2.5 bg-[#01779b]/10 rounded-2xl">
                <Users class="w-5 h-5 text-[#01779b]" />
              </div>
              <div>
                <h3 class="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter">Live Presence</h3>
                <p class="text-[10px] font-black uppercase tracking-widest text-[#01779b]">Currently Online</p>
              </div>
            </div>
            <button @click="isModalOpen = false" class="p-2 rounded-xl border-2 border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
              <X class="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <div class="space-y-3">
              <!-- You -->
              <div class="flex items-center justify-between p-3.5 bg-[#01779b]/5 dark:bg-[#01779b]/10 rounded-2xl border-2 border-[#01779b]/10">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full border-2 border-[#01779b] bg-white dark:bg-gray-800 overflow-hidden">
                    <img :src="`https://api.dicebear.com/9.x/open-peeps/svg?seed=${mySessionId}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`" class="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p class="text-[11px] font-black text-gray-900 dark:text-white">{{ myAnimal.name }}</p>
                    <p class="text-[9px] font-black uppercase tracking-widest text-[#01779b]">Your Persona</p>
                  </div>
                </div>
                <button @click="isModalOpen = false; startRename()" class="px-3 py-1.5 bg-[#01779b] text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">Rename</button>
              </div>

              <!-- Others -->
              <div v-for="v in visitors" :key="v.id" class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-transparent hover:border-gray-100 dark:hover:border-gray-700 transition-all">
                <div class="w-10 h-10 rounded-full border-2 border-white dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                  <img :src="`https://api.dicebear.com/9.x/open-peeps/svg?seed=${v.id}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`" class="w-full h-full object-cover" />
                </div>
                <div>
                  <p class="text-[11px] font-black text-gray-900 dark:text-white">{{ v.name }}</p>
                  <p class="text-[9px] font-black uppercase tracking-widest text-gray-400">Live Visitor</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </header>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #01779b44;
  border-radius: 10px;
}
</style>
