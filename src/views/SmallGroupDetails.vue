<script setup>
import { computed, nextTick, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Plus,
  MoreVertical,
  Pencil,
  Printer,
  FileSpreadsheet,
  Trash2,
  MapPin,
  CalendarDays,
  UsersRound,
  BookOpen,
  History,
} from '../icons'
import { useSmallGroups } from '../composables/useSmallGroups'
import { useSgSessions, useSessionPhotos } from '../composables/useSgSessions'
import { useMembers } from '../composables/useMembers'
import { useSgLanguage } from '../composables/useSgLanguage'
import { useToast } from '../composables/useToast'
import { getFullName, getAvatarUrl } from '../utils/memberUtils'
import {
  memberKey,
  findMemberById,
  rosterMembers,
  formatTimeRange,
  formatSessionDate,
  formatRelativeSessionDate,
} from '../utils/sgUtils'
import { exportSgGroupSessions } from '../utils/sgExport'
import SessionListItem from '../components/smallGroups/SessionListItem.vue'
import SessionEditorDrawer from '../components/smallGroups/SessionEditorDrawer.vue'
import AddEditGroupDrawer from '../components/smallGroups/AddEditGroupDrawer.vue'
import SessionFormPrintable from '../components/smallGroups/SessionFormPrintable.vue'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'
import YouBadge from '../components/members/YouBadge.vue'
import { usePermissions } from '../composables/usePermissions'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { lang, t, weekdayName } = useSgLanguage()
const { canManage } = usePermissions()

const groupId = computed(() => route.params.id)

const { groups, loading: groupsLoading, saveGroup, removeGroup } = useSmallGroups()
const { members } = useMembers()
const {
  sessions,
  loading: sessionsLoading,
  createSession,
  saveSession,
  removeSession,
} = useSgSessions(groupId)

const group = computed(
  () => groups.value.find((g) => g.firestoreId === groupId.value) || null
)

const roster = computed(() => rosterMembers(group.value, members.value))
const leader = computed(() => findMemberById(members.value, group.value?.leaderId))
const schedule = computed(() => {
  if (!group.value) return ''
  const day = group.value.meetingDay === null ? '' : weekdayName(group.value.meetingDay)
  return [day, formatTimeRange(group.value.meetingTime, '')].filter(Boolean).join(' • ')
})

// Sessions arrive newest first, so the head of the list is the last meeting.
// Recency is what the chip is for, so it reads "3 days ago" and keeps the
// calendar date on the tooltip.
const lastMetDate = computed(() => sessions.value[0]?.date || '')
const lastMetLabel = computed(() =>
  lastMetDate.value ? formatRelativeSessionDate(lastMetDate.value, lang.value) : '—'
)
const lastMetExact = computed(() =>
  lastMetDate.value ? formatSessionDate(lastMetDate.value, lang.value) : ''
)

/* ------------------------------------------------------------ session edit */
const showSessionDrawer = ref(false)
const editingSession = ref(null)
const saving = ref(false)

// Photos of whichever session the drawer currently has open.
const editingSessionId = computed(() => editingSession.value?.firestoreId || null)
const { photos: editingPhotos, addPhoto, removePhoto } = useSessionPhotos(editingSessionId)

const newSession = () => {
  editingSession.value = null
  showSessionDrawer.value = true
}

const openSession = (session) => {
  router.push(`/small-groups/${groupId.value}/sessions/${session.firestoreId}`)
}

const handleSessionSave = async (sessionData) => {
  saving.value = true
  try {
    if (editingSession.value) {
      await saveSession(editingSession.value.firestoreId, sessionData)
      toast.success('Session updated')
    } else {
      await createSession(sessionData)
      toast.success('Session recorded')
    }
    showSessionDrawer.value = false
  } catch (error) {
    console.error('Error saving SG session:', error)
    toast.error('Failed to save the session. Please try again.')
  } finally {
    saving.value = false
  }
}

const handlePhotoUpload = async (base64) => {
  try {
    await addPhoto(base64, '')
  } catch (error) {
    console.error('Error uploading session photo:', error)
    toast.error('Failed to upload the photo.')
  }
}

const handlePhotoDelete = async (photo) => {
  try {
    await removePhoto(photo)
  } catch (error) {
    console.error('Error deleting session photo:', error)
    toast.error('Failed to delete the photo.')
  }
}

/* -------------------------------------------------------------- group edit */
const showGroupDrawer = ref(false)
const showMenu = ref(false)

const handleGroupSave = async (groupData) => {
  saving.value = true
  try {
    await saveGroup(groupId.value, groupData)
    showGroupDrawer.value = false
    toast.success('Group updated')
  } catch (error) {
    console.error('Error updating small group:', error)
    toast.error('Failed to update the group. Please try again.')
  } finally {
    saving.value = false
  }
}

/* ------------------------------------------------------------ confirmation */
const showConfirmation = ref(false)
const confirmationConfig = ref({
  title: '',
  message: '',
  confirmText: 'Delete',
  confirmButtonClass: 'bg-red-600 text-white hover:bg-red-700',
  onConfirm: null,
})

const confirmDeleteGroup = () => {
  showGroupDrawer.value = false
  confirmationConfig.value = {
    ...confirmationConfig.value,
    title: 'Delete Small Group',
    message: `Delete "${group.value?.name}"? Every session and photo recorded under it is deleted too.`,
    onConfirm: async () => {
      try {
        await removeGroup(groupId.value)
        toast.success('Small group deleted')
        router.push('/small-groups')
      } catch (error) {
        console.error('Error deleting small group:', error)
        toast.error('Failed to delete the group.')
      }
    },
  }
  showConfirmation.value = true
}

const confirmDeleteSession = () => {
  const session = editingSession.value
  if (!session) return
  confirmationConfig.value = {
    ...confirmationConfig.value,
    title: 'Delete Session',
    message: `Delete the session dated ${session.date}? Its photos are deleted with it.`,
    onConfirm: async () => {
      try {
        await removeSession(session.firestoreId)
        showSessionDrawer.value = false
        toast.success('Session deleted')
      } catch (error) {
        console.error('Error deleting SG session:', error)
        toast.error('Failed to delete the session.')
      }
    },
  }
  showConfirmation.value = true
}

const handleConfirmation = () => {
  confirmationConfig.value.onConfirm?.()
}

/* ------------------------------------------------------------ print/export */
// The blank sheet is only mounted while printing, so it never flashes on screen.
const printBlank = ref(false)

const printBlankForm = async () => {
  showMenu.value = false
  printBlank.value = true
  await nextTick()
  window.print()
  printBlank.value = false
}

const handleExportAll = () => {
  showMenu.value = false
  if (!sessions.value.length) {
    toast.info('There are no sessions to export yet.')
    return
  }
  exportSgGroupSessions(sessions.value, group.value, members.value, lang.value)
}

/* ------------------------------------------------------- sessions by month */
const sessionsByMonth = computed(() => {
  const grouped = {}
  sessions.value.forEach((session) => {
    if (!session.date) return
    const date = new Date(session.date)
    if (Number.isNaN(date.getTime())) return
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    if (!grouped[key]) {
      grouped[key] = {
        label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        sessions: [],
      }
    }
    grouped[key].sessions.push(session)
  })
  return Object.entries(grouped)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, value]) => ({ key, ...value }))
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Top bar. The cover lives in the hero below, so this stays slim and
         keeps the group name visible while the body scrolls. -->
    <div class="shrink-0 flex items-center gap-1.5 pb-3 no-print">
      <button
        @click="router.push('/small-groups')"
        class="shrink-0 p-2 -ml-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="Back"
      >
        <ArrowLeft class="h-5 w-5" />
      </button>

      <h1 class="flex-1 min-w-0 truncate text-base font-semibold text-gray-900 dark:text-white">
        {{ group?.name || (groupsLoading ? '…' : 'Group not found') }}
      </h1>

      <div class="relative shrink-0">
        <button
          @click="showMenu = !showMenu"
          class="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="More actions"
        >
          <MoreVertical class="h-5 w-5" />
        </button>
        <!-- Invisible backdrop: mouseleave never fires on touch, so the menu
             needs something tappable to close against. -->
        <div v-if="showMenu" class="fixed inset-0 z-40" @click="showMenu = false" />
        <div
          v-if="showMenu"
          class="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1"
        >
          <button
            v-if="canManage('smallgroups')"
            @click="showMenu = false; showGroupDrawer = true"
            class="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Pencil class="h-4 w-4" />{{ t('edit') }}
          </button>
          <button
            @click="printBlankForm"
            class="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Printer class="h-4 w-4" />{{ t('printBlank') }}
          </button>
          <button
            @click="handleExportAll"
            class="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <FileSpreadsheet class="h-4 w-4" />{{ t('export') }}
          </button>
          <button
            v-if="canManage('smallgroups')"
            @click="showMenu = false; confirmDeleteGroup()"
            class="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 class="h-4 w-4" />{{ t('delete') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div class="flex-1 overflow-hidden flex relative no-print">
      <div class="flex-1 overflow-y-auto space-y-4 pb-4">
        <!-- Identity card. The cover is deliberately a small thumbnail rather
             than a full-bleed banner: at page width a 16:9 hero ran to roughly
             430px on desktop and pushed the roster and sessions below the fold.
             It keeps COVER_ASPECT exactly, so the framing still matches what
             the cropper previewed — it is only smaller. Leader, schedule and
             the three counts all sit beside the thumbnail rather than in strips
             and a card row of their own: a group with only a name used to leave
             the whole right half of the card empty. -->
        <section
          v-if="group"
          class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 sm:p-4"
        >
          <div class="flex items-start gap-3 sm:gap-4">
            <div
              class="relative w-24 sm:w-36 shrink-0 aspect-[16/9] rounded-xl overflow-hidden bg-gradient-to-br from-primary/25 via-primary/10 to-primary/5 dark:from-primary/30 dark:via-primary/15 dark:to-gray-800"
            >
              <img
                v-if="group.coverPhoto"
                :src="group.coverPhoto"
                alt=""
                class="absolute inset-0 h-full w-full object-cover"
              />
              <UsersRound
                v-else
                class="absolute inset-0 m-auto h-6 w-6 sm:h-8 sm:w-8 text-primary/40"
              />
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-start gap-2">
                <h2
                  class="flex-1 min-w-0 text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate"
                >
                  {{ group.name }}
                </h2>
                <span
                  v-if="!group.active"
                  class="shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                >
                  {{ t('inactive') }}
                </span>
              </div>

              <p
                v-if="group.description"
                class="mt-0.5 text-xs sm:text-sm text-gray-500 dark:text-gray-400 line-clamp-2"
              >
                {{ group.description }}
              </p>

              <div v-if="leader" class="mt-1.5 flex items-center gap-1.5 min-w-0">
                <img
                  :src="getAvatarUrl(leader)"
                  :alt="getFullName(leader)"
                  class="h-5 w-5 shrink-0 rounded-full object-cover bg-gray-100 dark:bg-gray-700"
                />
                <p class="min-w-0 truncate text-xs text-gray-500 dark:text-gray-400">
                  <span class="font-medium text-gray-700 dark:text-gray-200">{{
                    getFullName(leader)
                  }}</span>
                  · {{ t('leader') }}
                </p>
              </div>

              <!-- Schedule, place and the three counts share one chip cloud so
                   the space next to the thumbnail fills up at any width. -->
              <div class="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  v-if="schedule"
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300"
                >
                  <CalendarDays class="h-3.5 w-3.5" />{{ schedule }}
                </span>
                <span
                  v-if="group.location"
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 min-w-0 max-w-full"
                >
                  <MapPin class="h-3.5 w-3.5 shrink-0" /><span class="truncate">{{ group.location }}</span>
                </span>

                <span
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700/60"
                >
                  <UsersRound class="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span class="font-semibold text-gray-900 dark:text-white">{{ roster.length }}</span>
                  <span class="text-gray-500 dark:text-gray-400">{{ t('members') }}</span>
                </span>
                <span
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700/60"
                >
                  <BookOpen class="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span class="font-semibold text-gray-900 dark:text-white">{{ sessions.length }}</span>
                  <span class="text-gray-500 dark:text-gray-400">{{ t('sessions') }}</span>
                </span>
                <span
                  v-if="sessions.length"
                  :title="lastMetExact"
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700/60 min-w-0 max-w-full"
                >
                  <History class="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span class="shrink-0 text-gray-500 dark:text-gray-400">{{ t('lastMet') }}</span>
                  <span class="truncate font-semibold text-gray-900 dark:text-white">{{
                    lastMetLabel
                  }}</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- Roster -->
        <section
          class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
        >
          <h2
            class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3"
          >
            {{ t('members') }} ({{ roster.length }})
          </h2>
          <p v-if="roster.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('noMembers') }}
          </p>
          <ul v-else class="flex flex-wrap gap-2">
            <li
              v-for="member in roster"
              :key="memberKey(member)"
              class="inline-flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700"
            >
              <img
                :src="getAvatarUrl(member)"
                :alt="getFullName(member)"
                class="h-6 w-6 rounded-full object-cover"
              />
              <span class="text-xs font-medium text-gray-700 dark:text-gray-200">
                {{ member.nickname || getFullName(member) }}
              </span>
              <YouBadge :member="member" />
            </li>
          </ul>
        </section>

        <!-- Sessions -->
        <section
          class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
        >
          <div
            class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700"
          >
            <h2 class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {{ t('sessions') }}
            </h2>
            <button
              v-if="canManage('smallgroups')"
              @click="newSession"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors"
            >
              <Plus class="h-3.5 w-3.5" />{{ t('newSession') }}
            </button>
          </div>

          <div v-if="sessionsLoading" class="divide-y divide-gray-100 dark:divide-gray-700">
            <div v-for="i in 4" :key="`s-skeleton-${i}`" class="px-4 py-3.5 flex items-center gap-3">
              <div class="h-10 w-10 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div class="flex-1 space-y-2">
                <div class="h-3.5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div class="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </div>
          </div>

          <p
            v-else-if="sessions.length === 0"
            class="px-4 py-8 text-sm text-center text-gray-500 dark:text-gray-400"
          >
            {{ t('noSessions') }}
          </p>

          <div v-else class="divide-y divide-gray-100 dark:divide-gray-700">
            <template v-for="monthGroup in sessionsByMonth" :key="monthGroup.key">
              <div
                class="sticky top-0 z-10 bg-gray-100 dark:bg-gray-700 px-4 py-1.5 border-b border-gray-200 dark:border-gray-600"
              >
                <h3
                  class="text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300"
                >
                  {{ monthGroup.label }}
                </h3>
              </div>
              <SessionListItem
                v-for="session in monthGroup.sessions"
                :key="session.firestoreId"
                :session="session"
                @click="openSession(session)"
              />
            </template>
          </div>
        </section>
      </div>

      <SessionEditorDrawer
        v-if="group"
        v-model:show="showSessionDrawer"
        :session="editingSession"
        :group="group"
        :members="members"
        :photos="editingPhotos"
        :saving="saving"
        @save="handleSessionSave"
        @delete="confirmDeleteSession"
        @upload-photo="handlePhotoUpload"
        @delete-photo="handlePhotoDelete"
      />

      <AddEditGroupDrawer
        v-model:show="showGroupDrawer"
        :group="group"
        :members="members"
        :saving="saving"
        @save="handleGroupSave"
        @delete="confirmDeleteGroup"
      />
    </div>

    <!-- Blank paper form: mounted only for the duration of a print. -->
    <div v-if="printBlank" class="print-area print-only">
      <SessionFormPrintable :group="group" :members="members" />
    </div>

    <ConfirmationModal
      v-model:show="showConfirmation"
      :title="confirmationConfig.title"
      :message="confirmationConfig.message"
      :confirm-text="confirmationConfig.confirmText"
      :confirm-button-class="confirmationConfig.confirmButtonClass"
      @confirm="handleConfirmation"
    />
  </div>
</template>
