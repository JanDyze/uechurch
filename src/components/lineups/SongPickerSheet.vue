<script setup>
import { computed, ref, watch } from 'vue'
import { Check, ListMusic, Search, X } from '../../icons'
import { useFocusTrap } from '../../composables/useFocusTrap'
import { useAppSettings } from '../../composables/useAppSettings'
import { withAllOption } from '../../data/appDefaults'
import { keyForLeader } from '../../utils/lineupUtils'

const props = defineProps({
  show: { type: Boolean, default: false },
  songs: { type: Array, default: () => [] },
  // Already in the service order — shown flagged, so the same song is not
  // added twice by accident.
  chosenIds: { type: Array, default: () => [] },
  // Whoever is leading, so every row can show the key they sing it in.
  leaderId: { type: [String, Number], default: null },
  leaderName: { type: String, default: '' },
})

const emit = defineEmits(['update:show', 'add'])

const dialogRef = ref(null)
const search = ref('')
const category = ref('All')
const selected = ref([])

const { categories: appCategories } = useAppSettings()
const categories = computed(() => withAllOption(appCategories.value.songs))

// A fresh basket every time the sheet opens.
watch(
  () => props.show,
  (open) => {
    if (!open) return
    selected.value = []
    search.value = ''
    category.value = 'All'
  }
)

const close = () => emit('update:show', false)
useFocusTrap(dialogRef, computed(() => props.show), close)

const alreadyChosen = computed(() => new Set(props.chosenIds.map(String)))

const results = computed(() => {
  const q = search.value.trim().toLowerCase()
  return props.songs
    .filter((song) => category.value === 'All' || song.category === category.value)
    .filter((song) => !q || `${song.title} ${song.notes || ''}`.toLowerCase().includes(q))
    .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
})

const isSelected = (song) => selected.value.some((s) => s.id === song.id)

const toggle = (song) => {
  if (isSelected(song)) {
    selected.value = selected.value.filter((s) => s.id !== song.id)
  } else {
    selected.value = [...selected.value, song]
  }
}

const confirm = () => {
  if (!selected.value.length) return
  emit(
    'add',
    selected.value.map((song) => ({
      songId: song.id,
      title: song.title,
      category: song.category || '',
      // Pre-filled from the song list; the editor lets the leader override it
      // for this one service.
      key: keyForLeader(song, props.leaderId),
      note: '',
    }))
  )
  close()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="picker">
      <div v-if="show" class="fixed inset-0 z-90 flex flex-col justify-end sm:items-center sm:justify-center">
        <div class="absolute inset-0 bg-black/50" @click="close" />

        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="song-picker-title"
          tabindex="-1"
          class="relative z-10 w-full sm:max-w-lg max-h-[88dvh] sm:max-h-[80dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border-t sm:border border-gray-200 dark:border-gray-700"
        >
          <div class="shrink-0 px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <h3 id="song-picker-title" class="text-base font-semibold text-gray-900 dark:text-white">
                Add songs
              </h3>
              <p v-if="leaderName" class="text-xs text-gray-500 dark:text-gray-400 truncate">
                Keys shown are {{ leaderName }}&rsquo;s
              </p>
            </div>
            <button
              @click="close"
              class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Close"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <div class="shrink-0 px-4 pt-3 pb-2 space-y-2">
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                v-model="search"
                type="search"
                placeholder="Search songs"
                class="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div class="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
              <button
                v-for="option in categories"
                :key="option"
                @click="category = option"
                :class="[
                  'shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
                  category === option
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                ]"
              >
                {{ option }}
              </button>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto min-h-0 px-2 pb-2">
            <p v-if="!results.length" class="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
              <ListMusic class="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
              No songs match.
            </p>

            <button
              v-for="song in results"
              :key="song.id"
              @click="toggle(song)"
              :class="[
                'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors',
                isSelected(song) ? 'bg-primary/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
              ]"
            >
              <span
                :class="[
                  'shrink-0 h-6 w-6 rounded-md border flex items-center justify-center',
                  isSelected(song)
                    ? 'bg-primary border-primary text-white'
                    : 'border-gray-300 dark:border-gray-600'
                ]"
              >
                <Check v-if="isSelected(song)" class="h-4 w-4" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ song.title }}
                  <span
                    v-if="alreadyChosen.has(String(song.id))"
                    class="ml-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400"
                    >in lineup</span
                  >
                </span>
                <span class="block text-xs text-gray-500 dark:text-gray-400 truncate">
                  {{ song.category || 'Uncategorised' }}
                </span>
              </span>
              <span
                v-if="keyForLeader(song, leaderId)"
                class="shrink-0 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-xs font-bold text-gray-700 dark:text-gray-200"
              >
                {{ keyForLeader(song, leaderId) }}
              </span>
            </button>
          </div>

          <div class="shrink-0 p-3 border-t border-gray-100 dark:border-gray-700 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <button
              @click="confirm"
              :disabled="!selected.length"
              class="w-full py-3 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors"
            >
              {{ selected.length ? `Add ${selected.length} song${selected.length > 1 ? 's' : ''}` : 'Select songs to add' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.picker-enter-active,
.picker-leave-active {
  transition: opacity 0.2s ease;
}
.picker-enter-from,
.picker-leave-to {
  opacity: 0;
}
</style>
