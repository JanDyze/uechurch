<script setup>
import { computed, ref, watch } from 'vue'
import { X, Plus, Trash2, Check } from '../../icons'
import { useMediaQuery } from '../../composables/useMediaQuery'
import { useFocusTrap } from '../../composables/useFocusTrap'
import { useSgLanguage } from '../../composables/useSgLanguage'
import { getFullName } from '../../utils/memberUtils'
import { memberKey, rosterMembers } from '../../utils/sgUtils'
import { useMyMember } from '../../composables/useMyMember'
import LanguageToggle from './LanguageToggle.vue'
import SessionPhotoUploader from './SessionPhotoUploader.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  session: { type: Object, default: null },
  group: { type: Object, required: true },
  members: { type: Array, default: () => [] },
  photos: { type: Array, default: () => [] },
  saving: { type: Boolean, default: false },
})

const emit = defineEmits(['update:show', 'save', 'delete', 'upload-photo', 'delete-photo'])

const isMobile = useMediaQuery('(max-width: 1023px)')
const { lang, t } = useSgLanguage()
const { myMemberId } = useMyMember()
const dialogRef = ref(null)

const today = () => new Date().toISOString().split('T')[0]

const blankForm = () => ({
  date: today(),
  startTime: props.group?.meetingTime || '',
  endTime: '',
  venue: props.group?.location || '',
  leaderId: props.group?.leaderId ?? null,
  lesson: { title: '', scripture: '', notes: '', takeaways: '' },
  presentIds: [],
  guests: [],
  prayerRequests: [],
  challenges: '',
  notes: '',
})

const form = ref(blankForm())

watch(
  () => [props.show, props.session],
  ([show]) => {
    if (!show) return
    if (props.session) {
      form.value = {
        date: props.session.date,
        startTime: props.session.startTime,
        endTime: props.session.endTime,
        venue: props.session.venue,
        leaderId: props.session.leaderId,
        lesson: { ...props.session.lesson },
        presentIds: [...props.session.attendance.presentIds],
        guests: props.session.attendance.guests.map((guest) => ({ ...guest })),
        prayerRequests: props.session.prayerRequests.map((request) => ({ ...request })),
        challenges: props.session.challenges || '',
        notes: props.session.notes,
      }
    } else {
      form.value = blankForm()
    }
  },
  { immediate: true }
)

const isEdit = computed(() => Boolean(props.session))
const isValid = computed(() => Boolean(form.value.date))

const roster = computed(() => rosterMembers(props.group, props.members))

const isPresent = (id) => form.value.presentIds.some((selected) => String(selected) === String(id))

const togglePresent = (id) => {
  form.value.presentIds = isPresent(id)
    ? form.value.presentIds.filter((selected) => String(selected) !== String(id))
    : [...form.value.presentIds, String(id)]
}

const markAll = () => {
  form.value.presentIds = roster.value.map((member) => memberKey(member))
}
const clearAll = () => {
  form.value.presentIds = []
}

const totalPresent = computed(() => form.value.presentIds.length)
const totalAttendance = computed(() => totalPresent.value + form.value.guests.length)

const addGuest = () => {
  form.value.guests.push({ name: '', contact: '', invitedBy: '' })
}
const removeGuest = (index) => {
  form.value.guests.splice(index, 1)
}

const addPrayerRequest = () => {
  form.value.prayerRequests.push({ text: '', name: '', memberId: null })
}
const removePrayerRequest = (index) => {
  form.value.prayerRequests.splice(index, 1)
}

const close = () => emit('update:show', false)

const handleSave = () => {
  if (!isValid.value || props.saving) return

  const presentSet = new Set(form.value.presentIds.map(String))
  // Absentees are derived rather than tapped: the form only asks who showed up,
  // but the printed report needs the other column filled in.
  const absentIds = roster.value
    .map((member) => memberKey(member))
    .filter((id) => !presentSet.has(id))

  emit('save', {
    groupId: props.group.firestoreId || props.group.id,
    date: form.value.date,
    startTime: form.value.startTime,
    endTime: form.value.endTime,
    venue: form.value.venue,
    leaderId: form.value.leaderId,
    // Set once, by whoever first wrote the report; edits by others leave it be.
    recordedById: props.session?.recordedById ?? myMemberId.value,
    language: lang.value,
    lesson: { ...form.value.lesson },
    attendance: {
      presentIds: [...presentSet],
      absentIds,
      guests: form.value.guests
        .filter((guest) => guest.name.trim())
        .map((guest) => ({
          name: guest.name.trim(),
          contact: guest.contact || '',
          invitedBy: guest.invitedBy || '',
        })),
    },
    prayerRequests: form.value.prayerRequests
      .filter((request) => request.text.trim())
      .map((request) => ({
        text: request.text.trim(),
        name: request.name || '',
        memberId: request.memberId ?? null,
      })),
    challenges: form.value.challenges,
    notes: form.value.notes,
  })
}

useFocusTrap(dialogRef, computed(() => props.show), close)

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent'
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
const sectionClass =
  'text-xs font-bold uppercase tracking-wider text-primary border-b border-primary/20 pb-1.5 mb-3'
</script>

<template>
  <Teleport to="body" :disabled="!isMobile">
    <Transition :name="isMobile ? 'modal-sheet' : 'drawer'">
      <div
        v-if="show"
        :class="[
          isMobile
            ? 'fixed inset-0 z-80 flex flex-col justify-end'
            : 'sg-drawer border-l-4 border-primary bg-white dark:bg-gray-800 w-1/2 h-full flex flex-col shrink-0 shadow-2xl shadow-primary/20',
        ]"
      >
        <div v-if="isMobile" class="absolute inset-0 bg-black/50" @click="close" />

        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sg-session-drawer-title"
          tabindex="-1"
          :class="[
            'flex flex-col min-h-0',
            isMobile
              ? 'relative z-10 w-full max-h-[92dvh] rounded-t-2xl bg-white dark:bg-gray-800 shadow-2xl border-t border-gray-200 dark:border-gray-700'
              : 'flex-1',
          ]"
        >
          <!-- Header -->
          <div
            class="shrink-0 rounded-t-2xl border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3"
          >
            <div class="min-w-0">
              <h3
                id="sg-session-drawer-title"
                class="text-lg font-semibold text-gray-900 dark:text-white truncate"
              >
                {{ isEdit ? t('session') : t('newSession') }}
              </h3>
              <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ group.name }}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <LanguageToggle />
              <button
                @click="close"
                class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Close"
              >
                <X class="h-5 w-5" />
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-7">
            <!-- Session details -->
            <section>
              <h4 :class="sectionClass">{{ t('session') }}</h4>
              <div class="space-y-3">
                <div class="grid grid-cols-2 gap-3">
                  <div class="col-span-2">
                    <label :class="labelClass">
                      {{ t('date') }} <span class="text-red-500">*</span>
                    </label>
                    <input v-model="form.date" type="date" :class="inputClass" />
                  </div>
                  <div>
                    <label :class="labelClass">{{ t('startTime') }}</label>
                    <input v-model="form.startTime" type="time" :class="inputClass" />
                  </div>
                  <div>
                    <label :class="labelClass">{{ t('endTime') }}</label>
                    <input v-model="form.endTime" type="time" :class="inputClass" />
                  </div>
                </div>
                <div>
                  <label :class="labelClass">{{ t('venue') }}</label>
                  <input v-model="form.venue" type="text" :class="inputClass" />
                </div>
                <div>
                  <label :class="labelClass">{{ t('leader') }}</label>
                  <select v-model="form.leaderId" :class="inputClass">
                    <option :value="null">—</option>
                    <option v-for="m in roster" :key="`l-${memberKey(m)}`" :value="memberKey(m)">
                      {{ getFullName(m) }}
                    </option>
                  </select>
                </div>
              </div>
            </section>

            <!-- Lesson -->
            <section>
              <h4 :class="sectionClass">{{ t('lesson') }}</h4>
              <div class="space-y-3">
                <div>
                  <label :class="labelClass">{{ t('lessonTitle') }}</label>
                  <input v-model="form.lesson.title" type="text" :class="inputClass" />
                </div>
                <div>
                  <label :class="labelClass">{{ t('scripture') }}</label>
                  <input
                    v-model="form.lesson.scripture"
                    type="text"
                    placeholder="John 3:16-21"
                    :class="inputClass"
                  />
                </div>
                <div>
                  <label :class="labelClass">{{ t('discussionNotes') }}</label>
                  <textarea v-model="form.lesson.notes" rows="4" :class="inputClass" />
                </div>
                <div>
                  <label :class="labelClass">{{ t('takeaways') }}</label>
                  <textarea v-model="form.lesson.takeaways" rows="3" :class="inputClass" />
                </div>
              </div>
            </section>

            <!-- Attendance -->
            <section>
              <h4 :class="sectionClass">{{ t('attendance') }}</h4>

              <div class="flex items-center gap-2 mb-2 text-xs">
                <button
                  type="button"
                  @click="markAll"
                  class="px-2.5 py-1 rounded-md bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition-colors"
                >
                  {{ t('markAll') }}
                </button>
                <button
                  type="button"
                  @click="clearAll"
                  class="px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {{ t('clearAll') }}
                </button>
                <span class="ml-auto font-semibold text-gray-600 dark:text-gray-300">
                  {{ totalPresent }} / {{ roster.length }}
                </span>
              </div>

              <div
                class="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 max-h-72 overflow-y-auto"
              >
                <p
                  v-if="roster.length === 0"
                  class="p-4 text-sm text-center text-gray-500 dark:text-gray-400"
                >
                  {{ t('noMembers') }}
                </p>
                <button
                  v-for="member in roster"
                  :key="memberKey(member)"
                  type="button"
                  @click="togglePresent(memberKey(member))"
                  class="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <span
                    :class="[
                      'h-6 w-6 shrink-0 rounded-md border flex items-center justify-center transition-colors',
                      isPresent(memberKey(member))
                        ? 'bg-primary border-primary text-white'
                        : 'border-gray-300 dark:border-gray-600',
                    ]"
                  >
                    <Check v-if="isPresent(memberKey(member))" class="h-4 w-4" />
                  </span>
                  <span class="flex-1 text-sm text-gray-900 dark:text-white truncate">
                    {{ getFullName(member) }}
                  </span>
                  <span
                    :class="[
                      'text-xs font-semibold shrink-0',
                      isPresent(memberKey(member))
                        ? 'text-primary'
                        : 'text-gray-400 dark:text-gray-500',
                    ]"
                  >
                    {{ isPresent(memberKey(member)) ? t('present') : t('absent') }}
                  </span>
                </button>
              </div>

              <!-- Guests -->
              <div class="mt-4">
                <div class="flex items-center justify-between mb-2">
                  <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {{ t('guests') }}
                  </label>
                  <button
                    type="button"
                    @click="addGuest"
                    class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Plus class="h-3.5 w-3.5" />
                    {{ t('addGuest') }}
                  </button>
                </div>
                <div v-if="form.guests.length" class="space-y-2">
                  <div
                    v-for="(guest, index) in form.guests"
                    :key="`guest-${index}`"
                    class="flex items-start gap-2"
                  >
                    <div class="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        v-model="guest.name"
                        type="text"
                        :placeholder="t('guestName')"
                        :class="inputClass"
                      />
                      <input
                        v-model="guest.contact"
                        type="text"
                        :placeholder="t('guestContact')"
                        :class="inputClass"
                      />
                      <input
                        v-model="guest.invitedBy"
                        type="text"
                        :placeholder="t('invitedBy')"
                        :class="inputClass"
                      />
                    </div>
                    <button
                      type="button"
                      @click="removeGuest(index)"
                      class="mt-1.5 p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      aria-label="Remove guest"
                    >
                      <Trash2 class="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <p class="mt-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
                {{ t('totalAttendance') }}: {{ totalAttendance }}
              </p>
            </section>

            <!-- Prayer requests -->
            <section>
              <div class="flex items-center justify-between mb-3">
                <h4 :class="[sectionClass, 'mb-0 border-0 pb-0']">{{ t('prayerRequests') }}</h4>
                <button
                  type="button"
                  @click="addPrayerRequest"
                  class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  <Plus class="h-3.5 w-3.5" />
                  {{ t('add') }}
                </button>
              </div>
              <div v-if="form.prayerRequests.length" class="space-y-2">
                <div
                  v-for="(request, index) in form.prayerRequests"
                  :key="`prayer-${index}`"
                  class="flex items-start gap-2"
                >
                  <div class="flex-1 space-y-2">
                    <textarea
                      v-model="request.text"
                      rows="2"
                      :placeholder="t('prayerRequests')"
                      :class="inputClass"
                    />
                    <input
                      v-model="request.name"
                      type="text"
                      :placeholder="t('requestedBy')"
                      :class="inputClass"
                    />
                  </div>
                  <button
                    type="button"
                    @click="removePrayerRequest(index)"
                    class="mt-1.5 p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    aria-label="Remove prayer request"
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p v-else class="text-xs text-gray-500 dark:text-gray-400">{{ t('none') }}</p>
            </section>

            <!-- Photos -->
            <section>
              <h4 :class="sectionClass">{{ t('photos') }}</h4>
              <SessionPhotoUploader
                :photos="photos"
                :disabled="!isEdit"
                disabled-hint="Save the session first, then add photos."
                @upload="$emit('upload-photo', $event)"
                @delete="$emit('delete-photo', $event)"
              />
            </section>

            <!-- Challenges -->
            <section>
              <h4 :class="sectionClass">{{ t('challenges') }}</h4>
              <textarea v-model="form.challenges" rows="3" :class="inputClass" />
            </section>

            <!-- Notes -->
            <section>
              <h4 :class="sectionClass">{{ t('notes') }}</h4>
              <textarea v-model="form.notes" rows="3" :class="inputClass" />
            </section>
          </div>

          <!-- Sticky actions -->
          <div
            class="shrink-0 border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 flex items-center gap-2 bg-white dark:bg-gray-800 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <button
              v-if="isEdit"
              @click="$emit('delete')"
              class="px-3 py-2.5 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              {{ t('delete') }}
            </button>
            <button
              @click="close"
              class="ml-auto px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {{ t('cancel') }}
            </button>
            <button
              @click="handleSave"
              :disabled="!isValid || saving"
              class="px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ t('save') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sg-drawer {
  transition: max-width 0.3s ease-out, opacity 0.3s ease;
}
.drawer-enter-from.sg-drawer,
.drawer-leave-to.sg-drawer {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
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
