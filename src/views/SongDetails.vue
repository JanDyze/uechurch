<script setup>
/**
 * One song, with the whole screen given to its lyrics.
 *
 * The drawer on the song list is the right shape for checking a key or a link,
 * and the wrong shape for typing out a song: forty lines through a half-height
 * textarea is why lyrics get pasted in and left messy. This is the same move
 * the record-attendance page makes — a task that fills a route rather than a
 * panel.
 *
 * It also stages the projector. Slides are what will eventually be pushed to a
 * second screen, so the operator sees here exactly what the congregation will
 * see there, and can fix a bad break before Sunday rather than during it.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Check, Loader2, List, Cards, Copy, Sparkles } from '../icons'
import { subscribeToSongs, updateSong } from '../api/songsService'
import { analyseStructure } from '../api/songLookupService'
import { useToast } from '../composables/useToast'
import { usePermissions } from '../composables/usePermissions'
import { useDragReorder } from '../composables/useDragReorder'
import { useMediaQuery } from '../composables/useMediaQuery'
import { copyText } from '../utils/clipboard'
import {
  parseLyricSections,
  toSlides,
  songLyricsText,
  lyricLinesOnly,
  applyStructure,
  DEFAULT_LINES_PER_SLIDE,
} from '../utils/songUtils'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { canManage } = usePermissions()

const songs = ref([])
const isLoading = ref(true)
let unsubscribe = null

const song = computed(
  () => songs.value.find((entry) => String(entry.id) === String(route.params.id)) || null
)

// A local buffer rather than editing the document in place: a keystroke should
// not be a write, and the live section preview has to read what is being typed
// rather than what was last saved.
const draft = ref('')
// The running order, kept apart from the words: one Chorus in the text, sung
// three times on Sunday. Editing the arrangement should never mean editing the
// lyrics, which is exactly what inline repeat headings forced.
const sequence = ref([])
const isSaving = ref(false)
const seededFor = ref(null)

watch(
  song,
  (value) => {
    if (!value) return
    // Seed once per song. Without this guard every incoming snapshot would
    // overwrite an edit in progress, because the list re-emits on any change.
    if (seededFor.value === value.id) return
    draft.value = songLyricsText(value)
    sequence.value = Array.isArray(value.sequence) ? [...value.sequence] : []
    seededFor.value = value.id
  },
  { immediate: true }
)

const savedSequence = computed(() =>
  Array.isArray(song.value?.sequence) ? song.value.sequence : []
)

const isDirty = computed(
  () =>
    Boolean(song.value) &&
    (draft.value !== songLyricsText(song.value) ||
      sequence.value.join('|') !== savedSequence.value.join('|'))
)

const sections = computed(() => parseLyricSections(draft.value))
const linesPerSlide = ref(DEFAULT_LINES_PER_SLIDE)

// Asides belong in the room, not on the wall: "(oh)" projected in letters a
// foot high tells the congregation to sing something nobody sings. Dropped by
// toSlides unconditionally — there is no case for projecting one, so there is
// no switch for it either.
const slides = computed(() =>
  toSlides({ lyrics: draft.value, sequence: sequence.value }, linesPerSlide.value)
)

// --- Identifying the structure ---------------------------------------------
// One pass, two answers. Claude is given the numbered lines and answers with
// line numbers and labels for the structure; rebuilding the text from that
// happens in applyStructure, locally, so the only thing that can go wrong is a
// section boundary in the wrong place — visible, and undone by not saving.
//
// It also recapitalises the lines whose words address God, which used to be
// its own button on the song list. That half does come back as text, and the
// server has already thrown out any line whose words changed, so what arrives
// here is the church's own line with different capitals.
const isAnalysing = ref(false)

const identifySections = async () => {
  const lines = lyricLinesOnly(draft.value)
  if (lines.length < 2) {
    toast.warning('Not enough lyrics to work from yet.')
    return
  }

  isAnalysing.value = true
  try {
    const result = await analyseStructure(lines)

    // Recasing is applied to the lines before they are rebuilt, so a section
    // is written out once, already styled.
    const recased = result.recased || {}
    const styled = lines.map((line, index) => recased[index] ?? line)

    const { lyrics, sequence: order } = applyStructure(
      styled,
      result.sections,
      result.adlibLines
    )
    draft.value = lyrics
    sequence.value = order

    const unique = new Set(order).size
    const parts = [`${unique} sections`, `sung ${order.length} times`]
    if (result.adlibLines?.length) parts.push(`${result.adlibLines.length} ad-libs removed`)
    const recasedCount = Object.keys(recased).length
    if (recasedCount) parts.push(`${recasedCount} lines recapitalised`)
    if (result.covered < result.total) parts.push(`${result.total - result.covered} lines unplaced`)

    toast.success(`Identified ${parts.join(' · ')}. Check it, then Save.`)
  } catch (err) {
    toast.error(err.message || 'Could not analyse the song.')
  } finally {
    isAnalysing.value = false
  }
}

// --- Arrangement -----------------------------------------------------------
// An empty sequence means "sing it as written", which is the honest default
// for a song nobody has arranged yet — and what every song saved before this
// existed will have.
const sectionLabels = computed(() =>
  sections.value.filter((section) => !section.isRepeat).map((section) => section.label)
)

const runningOrder = computed(() =>
  sequence.value.length ? sequence.value : sectionLabels.value
)

const isArranged = computed(() => sequence.value.length > 0)

/** Editing starts from what is on screen, so the first change to an unarranged
 *  song keeps the order it already had rather than emptying it. */
const startFrom = () => (sequence.value.length ? [...sequence.value] : [...sectionLabels.value])

const addToOrder = (label) => {
  sequence.value = [...startFrom(), label]
}

const removeFromOrder = (index) => {
  const next = startFrom()
  next.splice(index, 1)
  sequence.value = next
}

// Dragging edits the running order, and both lists edit the same one: the
// chips are that order written out, the slides are it rendered. Reordering
// either has to mean the same thing, so they share a reader and a writer.
const readOrder = () => startFrom()
const writeOrder = (next) => {
  sequence.value = next
}

const { draggingIndex: draggingChip, dragItem: chipDrag } = useDragReorder(readOrder, writeOrder)

// A section can span several slides ("Chorus 1/2"), so a slide drag moves the
// arrangement entry behind it rather than the slide itself — otherwise half a
// chorus could be dragged away from its other half.
const slideOrder = () =>
  slides.value.map((slide) => ({ key: slide.orderIndex, label: runningOrder.value[slide.orderIndex] }))

const { draggingIndex: draggingSlide, dragItem: slideDrag } = useDragReorder(
  slideOrder,
  (next) => {
    // Collapse back to one entry per arrangement position, keeping the order
    // the drag just produced.
    const seen = new Set()
    const rebuilt = []
    next.forEach((entry) => {
      if (seen.has(entry.key)) return
      seen.add(entry.key)
      rebuilt.push(entry.label)
    })
    if (rebuilt.length) sequence.value = rebuilt
  }
)

/** Back to singing it as written. */
const clearOrder = () => {
  sequence.value = []
}

// --- Reordering the song itself --------------------------------------------
// Distinct from the arrangement above: this moves a section's words within the
// lyrics, changing the document. The arrangement only changes how often and in
// what order the sections are sung.
//
// Labels survive the move, so a saved arrangement stays valid — it refers to
// sections by name, not by position.
const rebuildFromSections = (ordered) => {
  draft.value = ordered
    .map((section) => {
      if (!section.label) return section.text
      // A legacy repeat marker has a label and no words; keep it as it was.
      return section.text ? `${section.label}\n${section.text}` : section.label
    })
    .filter((block) => block.trim())
    .join('\n\n')
}

const { draggingIndex: draggingSection, dragItem: sectionDrag } = useDragReorder(
  () => sections.value,
  rebuildFromSections
)

// --- Splitting the two panes -----------------------------------------------
// Writing wants width; checking the slide breaks wants width. Rather than
// guess a ratio, the divider is draggable — and only on a wide screen, since
// the panes stack on a phone.
const isDesktop = useMediaQuery('(min-width: 1024px)')
const editorWidth = ref(55)
const isResizing = ref(false)
const splitRef = ref(null)

const editorPaneStyle = computed(() =>
  isDesktop.value ? { width: `${editorWidth.value}%`, flex: '0 0 auto' } : {}
)

const startResize = (event) => {
  if (!isDesktop.value) return
  isResizing.value = true
  event.currentTarget?.setPointerCapture?.(event.pointerId)
}

const onResize = (event) => {
  if (!isResizing.value) return
  const box = splitRef.value?.getBoundingClientRect()
  if (!box || !box.width) return
  const percent = ((event.clientX - box.left) / box.width) * 100
  // Neither pane may be squeezed to nothing.
  editorWidth.value = Math.min(80, Math.max(25, percent))
}

const endResize = (event) => {
  if (!isResizing.value) return
  event.currentTarget?.releasePointerCapture?.(event.pointerId)
  isResizing.value = false
}

/** 'write' to type, 'slides' to see what the screen will show. */
const mode = ref('write')

const modeOptions = [
  { key: 'write', label: 'Write', icon: List },
  { key: 'slides', label: 'Slides', icon: Cards },
]

const save = async () => {
  if (!song.value || !isDirty.value || isSaving.value) return
  isSaving.value = true
  try {
    await updateSong(song.value.id, { lyrics: draft.value, sequence: sequence.value })
    toast.success('Lyrics saved.')
  } catch {
    toast.error('Could not save. Try again.')
  } finally {
    isSaving.value = false
  }
}

const copySlide = async (slide) => {
  if (await copyText(slide.text)) toast.success('Slide copied.')
  else toast.error('Could not copy.')
}

// Leaving with unsaved lyrics is the one loss this page can cause.
const warnIfDirty = (event) => {
  if (!isDirty.value) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => {
  unsubscribe = subscribeToSongs((data) => {
    songs.value = data
    isLoading.value = false
  })
  window.addEventListener('beforeunload', warnIfDirty)
})

onUnmounted(() => {
  unsubscribe?.()
  window.removeEventListener('beforeunload', warnIfDirty)
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div
      class="shrink-0 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800"
    >
      <div class="flex items-center gap-3">
        <button
          @click="router.push('/songs')"
          aria-label="Back to songs"
          class="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-primary dark:hover:bg-gray-700"
        >
          <ArrowLeft class="h-5 w-5" />
        </button>
        <div class="min-w-0 flex-1">
          <h1 class="truncate text-sm font-bold text-gray-900 dark:text-white">
            {{ song?.title || (isLoading ? 'Loading…' : 'Song not found') }}
          </h1>
          <p class="text-xs font-medium text-gray-400">
            {{ sections.length }} section{{ sections.length === 1 ? '' : 's' }} ·
            {{ slides.length }} slide{{ slides.length === 1 ? '' : 's' }}
            <span v-if="isDirty" class="text-amber-600 dark:text-amber-400">· unsaved</span>
          </p>
        </div>
        <button
          v-if="canManage('songs')"
          @click="save"
          :disabled="!isDirty || isSaving"
          class="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
        >
          <Loader2 v-if="isSaving" class="h-3.5 w-3.5 animate-spin" />
          <Check v-else class="h-3.5 w-3.5" />
          Save
        </button>
      </div>

      <!-- On a wide screen both panes are visible at once, so the toggle is
           only offered where there is room for one. -->
      <div class="mt-3 flex gap-1 lg:hidden">
        <button
          v-for="option in modeOptions"
          :key="option.key"
          @click="mode = option.key"
          :class="[
            'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors',
            mode === option.key
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
          ]"
        >
          <component :is="option.icon" class="h-3.5 w-3.5" />
          {{ option.label }}
        </button>
      </div>
    </div>

    <div ref="splitRef" class="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div
        :style="editorPaneStyle"
        :class="[
          'min-h-0 min-w-0 flex-1 flex-col p-4',
          mode === 'slides' ? 'hidden lg:flex' : 'flex',
        ]"
      >
        <div v-if="canManage('songs')" class="mb-2 flex shrink-0 items-center justify-between gap-2">
          <p class="text-xs font-bold text-gray-400">Lyrics</p>
          <button
            @click="identifySections"
            :disabled="isAnalysing"
            class="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary transition-all hover:bg-primary/20 disabled:opacity-40"
          >
            <Loader2 v-if="isAnalysing" class="h-3 w-3 animate-spin" />
            <Sparkles v-else class="h-3 w-3" />
            {{ isAnalysing ? 'Reading…' : 'Identify sections' }}
          </button>
        </div>
        <textarea
          v-model="draft"
          :readonly="!canManage('songs')"
          spellcheck="false"
          placeholder="Paste the lyrics here."
          class="min-h-0 w-full flex-1 resize-none rounded-xl border border-gray-300 bg-white px-4 py-3 font-mono text-sm leading-relaxed text-gray-900 outline-none focus:border-transparent focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        ></textarea>
        <!-- The document's own order. Dragging one of these moves that
             section's words within the lyrics, which is a different thing from
             the arrangement in the next pane: that one only decides how often
             and in what order the sections get sung. -->
        <div v-if="sections.length > 1" class="mt-3 shrink-0 space-y-1.5">
          <p class="text-xs font-bold text-gray-500 dark:text-gray-400">
            Sections
            <span class="font-medium text-gray-400">· drag to move a section's words</span>
          </p>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="(section, index) in sections"
              :key="index"
              v-bind="canManage('songs') ? sectionDrag(index) : {}"
              :class="[
                'flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-600 select-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
                draggingSection === index ? 'opacity-80 shadow-lg ring-2 ring-primary/40' : '',
              ]"
            >
              {{ section.label || 'Untitled' }}
              <span class="font-medium text-gray-400">{{ section.lines.length }}</span>
            </span>
          </div>
        </div>

        <p class="mt-2 shrink-0 text-xs text-gray-400">
          Sections come from the text itself — a Verse 2 on its own line names one, and a blank
          line starts one. With neither, they are worked out from what repeats.
        </p>
      </div>

      <!-- Draggable divider. Writing wants width and so does checking the
           slide breaks, so the split is the operator's to set. Hidden where
           the panes stack. -->
      <div
        @pointerdown="startResize"
        @pointermove="onResize"
        @pointerup="endResize"
        @pointercancel="endResize"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panes"
        :class="[
          'hidden w-1.5 shrink-0 cursor-col-resize touch-none lg:block',
          isResizing ? 'bg-primary' : 'bg-gray-200 hover:bg-primary/40 dark:bg-gray-700',
        ]"
      ></div>

      <div
        :class="[
          'min-h-0 flex-1 flex-col border-gray-200 dark:border-gray-700 lg:max-w-md lg:border-l',
          mode === 'write' ? 'hidden lg:flex' : 'flex',
        ]"
      >
        <div class="shrink-0 space-y-2 border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs font-bold text-gray-500 dark:text-gray-400">
              Arrangement
              <span v-if="!isArranged" class="font-medium text-gray-400">· as written</span>
            </p>
            <button
              v-if="isArranged && canManage('songs')"
              @click="clearOrder"
              class="rounded-lg px-2 py-0.5 text-xs font-bold text-gray-400 transition-colors hover:text-primary"
            >
              Reset
            </button>
          </div>

          <!-- The running order. One Chorus in the lyrics, sung as often as it
               appears here. -->
          <div class="flex flex-wrap gap-1">
            <span
              v-for="(label, index) in runningOrder"
              :key="index"
              v-bind="canManage('songs') ? chipDrag(index) : {}"
              :class="[
                'flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-2.5 pr-1 text-xs font-bold text-primary select-none',
                draggingChip === index ? 'opacity-80 shadow-lg ring-2 ring-primary/40' : '',
              ]"
            >
              {{ label }}
              <button
                v-if="canManage('songs')"
                @click="removeFromOrder(index)"
                @pointerdown.stop
                aria-label="Remove"
                class="rounded-full px-1 text-primary/50 transition-colors hover:text-red-500"
              >
                ×
              </button>
            </span>
            <span v-if="!runningOrder.length" class="text-xs text-gray-400">
              No sections yet.
            </span>
          </div>

          <div v-if="canManage('songs') && sectionLabels.length" class="flex flex-wrap gap-1">
            <button
              v-for="label in sectionLabels"
              :key="`add-${label}`"
              @click="addToOrder(label)"
              class="rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-xs font-bold text-gray-500 transition-colors hover:border-primary hover:text-primary dark:border-gray-600"
            >
              + {{ label }}
            </button>
          </div>

          <p v-if="canManage('songs') && runningOrder.length > 1" class="text-xs text-gray-400">
            Drag to reorder — the chips or the slides, whichever is easier.
          </p>

          <label
            class="flex items-center justify-between gap-2 pt-1 text-xs font-bold text-gray-500 dark:text-gray-400"
          >
            Lines per slide
            <select
              v-model.number="linesPerSlide"
              class="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option :value="2">2</option>
              <option :value="4">4</option>
              <option :value="6">6</option>
              <option :value="8">8</option>
            </select>
          </label>
        </div>

        <div class="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
          <p v-if="!slides.length" class="py-8 text-center text-sm text-gray-400">
            Nothing to show yet — the lyrics are empty.
          </p>

          <!-- One card per slide, broken exactly where the screen will break. -->
          <div v-else class="space-y-3">
            <div
              v-for="(slide, at) in slides"
              :key="at"
              v-bind="canManage('songs') ? slideDrag(at) : {}"
              :class="[
                'group rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900',
                canManage('songs') ? 'select-none' : '',
                draggingSlide === at ? 'opacity-80 shadow-xl ring-2 ring-primary/40' : '',
              ]"
            >
              <div class="mb-1.5 flex items-center justify-between gap-2">
                <span
                  class="text-[11px] font-bold uppercase tracking-wide text-primary dark:text-primary-light"
                >
                  <!-- Spaced with a margin, not a space: the template compiler
                       condenses a leading whitespace text node away, which ran
                       the two together as "Chorus1/2". -->
                  {{ slide.label }}
                  <span v-if="slide.part" class="ml-1 font-medium text-gray-400">{{
                    slide.part
                  }}</span>
                </span>
                <button
                  @click="copySlide(slide)"
                  @pointerdown.stop
                  aria-label="Copy slide"
                  class="rounded-lg p-1 text-gray-400 opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                >
                  <Copy class="h-3.5 w-3.5" />
                </button>
              </div>
              <pre
                class="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-gray-700 dark:text-gray-200"
                >{{ slide.text }}</pre
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
