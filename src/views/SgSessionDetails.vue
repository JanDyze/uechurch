<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Pencil, Printer, FileSpreadsheet } from 'lucide-vue-next'
import { useSmallGroups } from '../composables/useSmallGroups'
import { useSgSessions, useSessionPhotos } from '../composables/useSgSessions'
import { useMembers } from '../composables/useMembers'
import { useSgLanguage } from '../composables/useSgLanguage'
import { useToast } from '../composables/useToast'
import { exportSgSession } from '../utils/sgExport'
import SessionFormPrintable from '../components/smallGroups/SessionFormPrintable.vue'
import SessionEditorDrawer from '../components/smallGroups/SessionEditorDrawer.vue'
import { usePermissions } from '../composables/usePermissions'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { lang, setLang, t } = useSgLanguage()
const { canManage } = usePermissions()

const groupId = computed(() => route.params.id)
const sessionId = computed(() => route.params.sessionId)

const { groups } = useSmallGroups()
const { members } = useMembers()
const { sessions, loading, saveSession, removeSession } = useSgSessions(groupId)
const { photos, addPhoto, removePhoto } = useSessionPhotos(sessionId)

const group = computed(() => groups.value.find((g) => g.firestoreId === groupId.value) || null)
const session = computed(
  () => sessions.value.find((s) => s.firestoreId === sessionId.value) || null
)

const ready = computed(() => Boolean(session.value))

// A saved session remembers the language it was written in, so it opens the
// way it was filled out; after that the toggle is the user's to drive.
let languageApplied = false
watch(
  session,
  (value) => {
    if (!value || languageApplied) return
    languageApplied = true
    setLang(value.language)
  },
  { immediate: true }
)

/* ------------------------------------------------------------------ actions */
const showEditor = ref(false)
const saving = ref(false)

const handleSave = async (sessionData) => {
  saving.value = true
  try {
    await saveSession(sessionId.value, sessionData)
    showEditor.value = false
    toast.success('Session updated')
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

const handlePrint = () => window.print()

const handleExport = () => {
  if (!session.value) return
  exportSgSession(session.value, group.value, members.value, lang.value)
}

const showConfirmation = ref(false)
const confirmDelete = () => {
  showConfirmation.value = true
}
const handleConfirmation = async () => {
  try {
    await removeSession(sessionId.value)
    toast.success('Session deleted')
    router.push(`/small-groups/${groupId.value}`)
  } catch (error) {
    console.error('Error deleting SG session:', error)
    toast.error('Failed to delete the session.')
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Action bar -->
    <div class="shrink-0 flex items-center gap-2 pb-3 no-print">
      <button
        @click="router.push(`/small-groups/${groupId}`)"
        class="shrink-0 p-2 -ml-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="Back"
      >
        <ArrowLeft class="h-5 w-5" />
      </button>

      <h1 class="flex-1 min-w-0 text-base font-bold text-gray-900 dark:text-white truncate">
        {{ session?.lesson?.title || t('sessionReport') }}
      </h1>

      <button
        v-if="canManage('smallgroups')"
        @click="showEditor = true"
        :disabled="!ready"
        class="shrink-0 p-2.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
        :title="t('edit')"
        :aria-label="t('edit')"
      >
        <Pencil class="h-4.5 w-4.5" />
      </button>
      <button
        @click="handleExport"
        :disabled="!ready"
        class="shrink-0 p-2.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
        :title="t('export')"
        :aria-label="t('export')"
      >
        <FileSpreadsheet class="h-4.5 w-4.5" />
      </button>
      <button
        @click="handlePrint"
        :disabled="!ready"
        class="shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-40"
      >
        <Printer class="h-4 w-4" />
        <span class="hidden sm:inline">{{ t('print') }}</span>
      </button>
    </div>

    <!-- The form itself -->
    <div class="flex-1 overflow-y-auto flex relative">
      <div class="flex-1 min-w-0 print-area">
        <div
          v-if="loading && !session"
          class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-3 no-print"
        >
          <div class="h-6 w-56 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div class="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div class="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>

        <p
          v-else-if="!session"
          class="p-8 text-center text-gray-500 dark:text-gray-400 no-print"
        >
          Session not found.
        </p>

        <div
          v-else
          class="mx-auto w-full max-w-3xl mb-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden sg-paper"
        >
          <SessionFormPrintable
            :group="group"
            :session="session"
            :members="members"
            :photos="photos"
          />
        </div>
      </div>

      <SessionEditorDrawer
        v-if="group && session"
        v-model:show="showEditor"
        :session="session"
        :group="group"
        :members="members"
        :photos="photos"
        :saving="saving"
        @save="handleSave"
        @delete="confirmDelete"
        @upload-photo="handlePhotoUpload"
        @delete-photo="handlePhotoDelete"
      />
    </div>

    <ConfirmationModal
      v-model:show="showConfirmation"
      title="Delete Session"
      message="Delete this session? Its photos are deleted with it."
      confirm-text="Delete"
      confirm-button-class="bg-red-600 text-white hover:bg-red-700"
      @confirm="handleConfirmation"
    />
  </div>
</template>

<style scoped>
@media print {
  /* On paper the sheet is the page — drop the card chrome around it. */
  .sg-paper {
    max-width: none;
    margin: 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
}
</style>
