<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import {
  Globe,
  Plus,
  Trash2,
  Loader2,
  Info,
  ImagePlus,
  RotateCcw,
  ExternalLink,
  Check,
  EyeOff,
  Image as ImageIcon,
  ShieldAlert,
} from '../../icons'
import { usePermissions } from '../../composables/usePermissions'
import { useAppSettings } from '../../composables/useAppSettings'
import { useToast } from '../../composables/useToast'
import {
  useRecurringSchedules,
  WEEKDAYS,
  OCCURRENCES,
  sortOccurrences,
} from '../../composables/useRecurringSchedules'
import { subscribeToAlbums } from '../../api/galleryService'
import { formatTime } from '../../../lib/occurrences'
import { compressImageToBase64 } from '../../utils/imageUtils'
import bundledHero from '../../assets/church.jpg'

// The hero rides inside appSettings/church, which every signed-in screen
// subscribes to in full — so it gets a budget close to the logo's rather than a
// gallery photo's. Full-bleed at 1400px wide is enough for a phone or a laptop.
const HERO_OPTIONS = { maxSize: 160 * 1024, maxDim: 1400 }

const toast = useToast()
const { isAdmin } = usePermissions()
const { landing, saveLanding } = useAppSettings()

const blankService = () => ({ name: '', when: '', note: '' })

const cloneLanding = (source) => ({
  ...source,
  services: (source.services || []).map((service) => ({ ...service })),
  // Copied, not shared: the picker below replaces this array, and holding the
  // stored one would make every edit look already-saved.
  hiddenAlbums: [...(source.hiddenAlbums || [])],
})

const form = ref(cloneLanding(landing.value))
const saving = ref(false)
const uploading = ref(false)

const dirty = computed(
  () => JSON.stringify(form.value) !== JSON.stringify(cloneLanding(landing.value))
)

// The document arrives after first render and may change from another device —
// resync unless the admin is mid-edit.
watch(landing, (next) => {
  if (!dirty.value) form.value = cloneLanding(next)
})

const heroPreview = computed(() => form.value.heroImage || bundledHero)
const heroInput = ref(null)

/** The toggle and the hero are single values with nothing to type alongside
 *  them, so they save on the spot; the text fields wait for Save. */
const persist = async (partial, message) => {
  try {
    await saveLanding(partial)
    if (message) toast.success(message)
  } catch (error) {
    console.error('Error saving landing settings:', error)
    toast.error('Could not save. Please try again.')
  }
}

const toggleEnabled = () => {
  const enabled = !form.value.enabled
  form.value.enabled = enabled
  persist(
    { enabled },
    enabled ? 'Public page is live at /' : 'Visitors now go straight to sign-in'
  )
}

const toggleEvents = () => {
  const showEvents = form.value.showEvents === false
  form.value.showEvents = showEvents
  persist(
    { showEvents },
    showEvents ? 'Upcoming gatherings are shown' : 'Upcoming gatherings are hidden'
  )
}

/* ------------------------------------------------------------- gallery */
// Which albums a visitor may see. Opted into one at a time on purpose: the
// people in the photographs did not put them on the internet, and "the whole
// gallery" is not a decision anyone should be able to make with one switch.
//
// Loaded only once the picker is opened. An album document carries its cover
// photo as base64, so listing them all is megabytes — not something to spend
// on everyone who opens Settings to change the church's name.
const albums = ref([])
const picking = ref(false)
const loadingAlbums = ref(false)
let unsubscribeAlbums = null

const openPicker = () => {
  picking.value = true
  if (unsubscribeAlbums) return
  loadingAlbums.value = true
  unsubscribeAlbums = subscribeToAlbums((list) => {
    albums.value = list
    loadingAlbums.value = false
  })
}

onUnmounted(() => unsubscribeAlbums?.())

// Stored as the exception: what is held back, not what is shared. An album
// added next month is on the page the moment it exists, which is the point —
// nobody has to come back here to keep the public page alive.
const hiddenAlbums = computed(() => form.value.hiddenAlbums || [])
const isShared = (albumId) => !hiddenAlbums.value.includes(albumId)
const sharedCount = computed(
  () => albums.value.filter((album) => isShared(album.id)).length
)

const toggleAlbum = (albumId) => {
  form.value.hiddenAlbums = isShared(albumId)
    ? [...hiddenAlbums.value, albumId]
    : hiddenAlbums.value.filter((id) => id !== albumId)
}

const shareAllAlbums = () => {
  form.value.hiddenAlbums = []
}
const shareNoAlbums = () => {
  form.value.hiddenAlbums = albums.value.map((album) => album.id)
}

const togglePhotos = () => {
  const showPhotos = form.value.showPhotos === false
  form.value.showPhotos = showPhotos
  persist(
    { showPhotos },
    showPhotos ? 'Gallery photos are shown' : 'No gallery photo is public now'
  )
}

/* ------------------------------------------------- service suggestions */
// The weekly schedule already knows when the church meets. Retyping it here
// is how the two drift apart, so each one is offered as a chip that fills in a
// service row the admin can then word however they like.
const { schedules } = useRecurringSchedules()

const scheduleWhen = (schedule) => {
  const weekday = WEEKDAYS.find((w) => w.value === schedule.weekday)?.label || ''
  const weeks = sortOccurrences(schedule.occurrences || [])
  const which = weeks.length
    ? `${weeks.map((v) => OCCURRENCES.find((o) => o.value === v)?.label || v).join(' & ')} ${weekday}`
    : `Every ${weekday}`
  return [which.trim(), formatTime(schedule.time)].filter(Boolean).join(', ')
}

/** Only what is not already on the list, and only what runs. */
const suggestions = computed(() => {
  const listed = new Set(
    form.value.services.map((service) => (service.name || '').trim().toLowerCase())
  )
  return schedules.value
    .filter((schedule) => schedule.enabled !== false && schedule.title)
    .filter((schedule) => !listed.has(schedule.title.trim().toLowerCase()))
    .map((schedule) => ({
      id: schedule.id,
      name: schedule.title,
      when: scheduleWhen(schedule),
    }))
})

const addSuggestion = (suggestion) => {
  form.value.services = [
    ...form.value.services,
    { name: suggestion.name, when: suggestion.when, note: '' },
  ]
}

const handleHeroFile = async (event) => {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  uploading.value = true
  try {
    const heroImage = await compressImageToBase64(file, HERO_OPTIONS)
    form.value.heroImage = heroImage
    await persist({ heroImage }, 'Hero photo updated')
  } catch (error) {
    console.error('Error saving the hero photo:', error)
    toast.error('Could not save that image. Try a smaller JPG.')
  } finally {
    uploading.value = false
  }
}

const resetHero = async () => {
  form.value.heroImage = ''
  await persist({ heroImage: '' }, 'Hero photo reset to the built-in one')
}

const addService = () => {
  form.value.services = [...form.value.services, blankService()]
}

const removeService = (index) => {
  form.value.services = form.value.services.filter((_, i) => i !== index)
}

const handleSave = async () => {
  if (saving.value) return
  saving.value = true
  try {
    const trimmed = (value) => (value || '').trim()
    const payload = {
      ...form.value,
      tagline: trimmed(form.value.tagline),
      intro: trimmed(form.value.intro),
      aboutTitle: trimmed(form.value.aboutTitle),
      about: trimmed(form.value.about),
      address: trimmed(form.value.address),
      mapUrl: trimmed(form.value.mapUrl),
      phone: trimmed(form.value.phone),
      email: trimmed(form.value.email),
      facebook: trimmed(form.value.facebook),
      // A row with no name renders nothing on the page, so it is dropped rather
      // than stored as an empty card.
      services: form.value.services
        .filter((service) => trimmed(service.name))
        .map((service) => ({
          name: trimmed(service.name),
          when: trimmed(service.when),
          note: trimmed(service.note),
        })),
    }
    await saveLanding(payload)
    // Adopt what was actually stored, so trimming does not leave the form
    // looking unsaved.
    form.value = cloneLanding(payload)
    toast.success('Public page saved')
  } catch (error) {
    console.error('Error saving landing settings:', error)
    toast.error('Could not save. Please try again.')
  } finally {
    saving.value = false
  }
}

const inputClass =
  'w-full h-11 px-3 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary'
const areaClass =
  'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary'
const labelClass = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'
</script>

<template>
  <section
    class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
  >
    <div class="flex items-start gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-700">
      <div class="p-2 rounded-lg bg-primary/10 shrink-0">
        <Globe class="h-5 w-5 text-primary dark:text-primary-light" />
      </div>
      <div class="min-w-0 flex-1">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Public page</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          What a visitor sees at the site address, before signing in
        </p>
      </div>
      <a
        href="/?preview=1"
        target="_blank"
        rel="noopener noreferrer"
        class="shrink-0 inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-600 px-3 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <ExternalLink class="h-3.5 w-3.5" />
        Preview
      </a>
    </div>

    <p v-if="!isAdmin" class="px-4 py-6 text-sm text-center text-gray-500 dark:text-gray-400">
      Only administrators can change the public page.
    </p>

    <template v-else>
      <!-- Live switch -->
      <div class="flex items-center gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-700">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-gray-900 dark:text-white">Show the public page</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            When off, visitors landing on the site go straight to the sign-in screen
          </p>
        </div>
        <button
          @click="toggleEnabled"
          :class="[
            'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
            form.enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600',
          ]"
          role="switch"
          :aria-checked="form.enabled"
          aria-label="Show the public page"
        >
          <span
            :class="[
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
              form.enabled ? 'translate-x-6' : 'translate-x-1',
            ]"
          ></span>
        </button>
      </div>

      <!-- What's coming up -->
      <div class="flex items-center gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-700">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-gray-900 dark:text-white">Show what's coming up</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            The next few gatherings from your calendar. Titles and times only — never where
            they meet, and never one aimed at particular members.
          </p>
        </div>
        <button
          @click="toggleEvents"
          :class="[
            'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
            form.showEvents !== false ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600',
          ]"
          role="switch"
          :aria-checked="form.showEvents !== false"
          aria-label="Show what's coming up"
        >
          <span
            :class="[
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
              form.showEvents !== false ? 'translate-x-6' : 'translate-x-1',
            ]"
          ></span>
        </button>
      </div>

      <div class="p-4 space-y-5">
        <div
          class="flex items-start gap-2 rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3 text-xs text-gray-600 dark:text-gray-300"
        >
          <Info class="h-4 w-4 shrink-0 text-gray-400 mt-0.5" />
          <p>
            Anything left empty is hidden on the page rather than shown blank — so a
            section only appears once you have something to put in it. The church name,
            branch and logo come from the Church tab.
          </p>
        </div>

        <!-- Hero -->
        <div>
          <label :class="labelClass">Hero photo</label>
          <div
            class="relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600"
          >
            <img :src="heroPreview" alt="" class="h-32 w-full object-cover" />
            <div class="absolute inset-0 bg-gray-900/35"></div>
            <div class="absolute inset-0 flex items-center justify-center gap-2">
              <input
                ref="heroInput"
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleHeroFile"
              />
              <button
                @click="heroInput?.click()"
                :disabled="uploading"
                class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/95 px-3 text-xs font-semibold text-gray-900 disabled:opacity-60"
              >
                <Loader2 v-if="uploading" class="h-3.5 w-3.5 animate-spin" />
                <ImagePlus v-else class="h-3.5 w-3.5" />
                Change
              </button>
              <button
                v-if="form.heroImage"
                @click="resetHero"
                :disabled="uploading"
                class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/95 px-3 text-xs font-semibold text-gray-900 disabled:opacity-60"
              >
                <RotateCcw class="h-3.5 w-3.5" />
                Reset
              </button>
            </div>
          </div>
          <p class="mt-1 text-[11px] text-gray-400">
            Saved as soon as you pick it. Sits behind the welcome text whenever the
            gallery has no photo to show there.
          </p>
        </div>

        <!-- Gallery albums -->
        <div>
          <div class="flex items-center gap-3 mb-2">
            <div class="min-w-0 flex-1">
              <p class="text-xs font-semibold text-gray-700 dark:text-gray-200">
                Photos from the gallery
              </p>
              <p class="text-[11px] text-gray-400">
                The hero rotates through a random handful, and they fill the "Life at
                church" strip
              </p>
            </div>
            <button
              @click="togglePhotos"
              :class="[
                'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
                form.showPhotos !== false ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600',
              ]"
              role="switch"
              :aria-checked="form.showPhotos !== false"
              aria-label="Show photos from the gallery"
            >
              <span
                :class="[
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  form.showPhotos !== false ? 'translate-x-6' : 'translate-x-1',
                ]"
              ></span>
            </button>
          </div>

          <template v-if="form.showPhotos !== false">
            <div
              class="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-800 dark:text-amber-200 mb-3"
            >
              <ShieldAlert class="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Every album is on the open internet, faces included, and a new one goes up
                as soon as it is created. Untick any that should stay behind the sign-in.
              </p>
            </div>

            <div v-if="picking && albums.length" class="flex items-center gap-1 mb-2">
              <button
                @click="shareAllAlbums"
                class="h-9 rounded-lg px-2.5 text-xs font-semibold text-primary dark:text-primary-light hover:bg-primary/10 transition-colors"
              >
                Share all
              </button>
              <button
                @click="shareNoAlbums"
                class="h-9 rounded-lg px-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Hide all
              </button>
            </div>

            <!-- Album covers are base64 inside the documents, so the list is only
                 fetched once somebody actually wants to pick from it. -->
            <button
              v-if="!picking"
              @click="openPicker"
              class="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:border-primary hover:text-primary dark:hover:text-primary-light transition-colors"
            >
              <ImageIcon class="h-4 w-4" />
              {{
                hiddenAlbums.length
                  ? `Choose albums (${hiddenAlbums.length} held back)`
                  : 'Choose albums'
              }}
            </button>

            <p v-else-if="loadingAlbums" class="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 class="h-3.5 w-3.5 animate-spin" />
              Loading albums…
            </p>

            <div v-else-if="albums.length" class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                v-for="album in albums"
                :key="album.id"
                @click="toggleAlbum(album.id)"
                :class="[
                  'relative overflow-hidden rounded-lg border text-left transition-colors',
                  isShared(album.id)
                    ? 'border-primary ring-1 ring-primary'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500',
                ]"
                :aria-pressed="isShared(album.id)"
              >
                <div class="aspect-4/3 w-full bg-gray-100 dark:bg-gray-900">
                  <img
                    v-if="album.coverUrl"
                    :src="album.coverUrl"
                    alt=""
                    :class="[
                      'h-full w-full object-cover transition-opacity',
                      isShared(album.id) ? '' : 'opacity-40 grayscale',
                    ]"
                  />
                  <div v-else class="flex h-full w-full items-center justify-center">
                    <ImageIcon class="h-6 w-6 text-gray-300 dark:text-gray-600" />
                  </div>
                </div>
                <div class="p-2">
                  <p class="truncate text-xs font-semibold text-gray-900 dark:text-white">
                    {{ album.title || 'Untitled' }}
                  </p>
                  <p class="truncate text-[11px] text-gray-400">
                    {{ [album.category, album.date].filter(Boolean).join(' · ') }}
                  </p>
                </div>
                <div
                  v-if="isShared(album.id)"
                  class="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow"
                >
                  <Check class="h-3.5 w-3.5" />
                </div>
                <div
                  v-else
                  class="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-gray-900/70 text-white shadow"
                >
                  <EyeOff class="h-3.5 w-3.5" />
                </div>
              </button>
            </div>
            <p v-else class="text-xs italic text-gray-400">No albums in the gallery yet.</p>

            <p v-if="picking && albums.length" class="mt-2 text-[11px] text-gray-400">
              {{ sharedCount }} of {{ albums.length }} on the public page · saved with the
              button at the bottom
            </p>
          </template>
        </div>

        <!-- Welcome -->
        <div>
          <label :class="labelClass">Headline</label>
          <input v-model="form.tagline" type="text" :class="inputClass" />
          <p class="mt-1 text-[11px] text-gray-400">The big line across the photo</p>
        </div>

        <div>
          <label :class="labelClass">Welcome paragraph</label>
          <textarea v-model="form.intro" rows="3" :class="areaClass"></textarea>
        </div>

        <!-- Services -->
        <div>
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="min-w-0">
              <p class="text-xs font-semibold text-gray-700 dark:text-gray-200">Service times</p>
              <p class="text-[11px] text-gray-400">
                Listed in this order. With none added, the section is hidden.
              </p>
            </div>
            <button
              @click="addService"
              class="shrink-0 inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white transition-transform active:scale-95"
            >
              <Plus class="h-4 w-4" />
              Add
            </button>
          </div>

          <div v-if="suggestions.length" class="mb-2 flex flex-wrap gap-1.5">
            <button
              v-for="suggestion in suggestions"
              :key="suggestion.id"
              @click="addSuggestion(suggestion)"
              class="inline-flex items-center gap-1.5 rounded-full border border-dashed border-gray-300 dark:border-gray-600 px-3 py-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:border-primary hover:text-primary dark:hover:text-primary-light transition-colors"
            >
              <Plus class="h-3 w-3" />
              {{ suggestion.name }}
              <span class="font-normal text-gray-400">{{ suggestion.when }}</span>
            </button>
          </div>

          <div v-if="form.services.length" class="space-y-2">
            <div
              v-for="(service, index) in form.services"
              :key="`service-${index}`"
              class="rounded-lg border border-gray-200 dark:border-gray-600 p-3 space-y-2"
            >
              <div class="flex items-center gap-2">
                <input
                  v-model="service.name"
                  type="text"
                  placeholder="Sunday Worship"
                  :class="[inputClass, 'flex-1 min-w-0']"
                />
                <button
                  @click="removeService(index)"
                  class="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  :aria-label="`Remove service ${index + 1}`"
                >
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>
              <input
                v-model="service.when"
                type="text"
                placeholder="Every Sunday, 9:00 AM"
                :class="inputClass"
              />
              <input
                v-model="service.note"
                type="text"
                placeholder="Optional note — e.g. Children's church runs alongside"
                :class="inputClass"
              />
            </div>
          </div>
          <p v-else class="text-xs italic text-gray-400">No service times added yet.</p>
        </div>

        <!-- About -->
        <div>
          <label :class="labelClass">About heading</label>
          <input v-model="form.aboutTitle" type="text" placeholder="Who we are" :class="inputClass" />
        </div>

        <div>
          <label :class="labelClass">About the church</label>
          <textarea
            v-model="form.about"
            rows="5"
            placeholder="A few sentences a visitor would want to read"
            :class="areaClass"
          ></textarea>
        </div>

        <!-- Finding and contacting us -->
        <div>
          <label :class="labelClass">Address</label>
          <textarea v-model="form.address" rows="2" :class="areaClass"></textarea>
          <p class="mt-1 text-[11px] text-gray-400">
            Shown with a "Get directions" link that searches this address on the map
          </p>
        </div>

        <div>
          <label :class="labelClass">Map link (optional)</label>
          <input
            v-model="form.mapUrl"
            type="url"
            placeholder="https://maps.app.goo.gl/..."
            :class="inputClass"
          />
          <p class="mt-1 text-[11px] text-gray-400">
            Use this when the address alone does not find the right pin
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <label :class="labelClass">Phone</label>
            <input v-model="form.phone" type="tel" :class="inputClass" />
          </div>
          <div>
            <label :class="labelClass">Email</label>
            <input v-model="form.email" type="email" :class="inputClass" />
          </div>
        </div>

        <div>
          <label :class="labelClass">Facebook page</label>
          <input
            v-model="form.facebook"
            type="url"
            placeholder="https://facebook.com/..."
            :class="inputClass"
          />
        </div>

        <button
          @click="handleSave"
          :disabled="!dirty || saving"
          class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-white text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          <Loader2 v-if="saving" class="h-4 w-4 animate-spin" />
          Save
        </button>
      </div>
    </template>
  </section>
</template>
