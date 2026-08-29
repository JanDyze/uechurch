<script setup>
import { computed, nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Search, UsersRound, Printer, X } from 'lucide-vue-next'
import { useSmallGroups } from '../composables/useSmallGroups'
import { useMembers } from '../composables/useMembers'
import { useSgLanguage } from '../composables/useSgLanguage'
import { useToast } from '../composables/useToast'
import { memberNameById } from '../utils/sgUtils'
import SmallGroupCard from '../components/smallGroups/SmallGroupCard.vue'
import AddEditGroupDrawer from '../components/smallGroups/AddEditGroupDrawer.vue'
import SessionFormPrintable from '../components/smallGroups/SessionFormPrintable.vue'
import { usePermissions } from '../composables/usePermissions'

const router = useRouter()
const toast = useToast()
const { t } = useSgLanguage()
const { canManage } = usePermissions()
const { groups, loading, createGroup } = useSmallGroups()
const { members } = useMembers()

const searchQuery = ref('')
const showGroupDrawer = ref(false)
const saving = ref(false)

const filteredGroups = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return groups.value
  return groups.value.filter((group) => {
    const leader = memberNameById(members.value, group.leaderId)
    return `${group.name} ${group.location} ${leader}`.toLowerCase().includes(query)
  })
})

/* ------------------------------------------------------------------ print */
// Printing needs a group so the sheet carries its name and roster, but the
// list page has no current group — so the button asks which one first.
const showPrintPicker = ref(false)
const printGroup = ref(null)

const printBlankFor = async (group) => {
  showPrintPicker.value = false
  printGroup.value = group
  // The sheet is mounted only for the duration of the print, so it never
  // flashes on screen.
  await nextTick()
  window.print()
  printGroup.value = null
}

const openGroup = (group) => {
  router.push(`/small-groups/${group.firestoreId || group.id}`)
}

const handleSave = async (groupData) => {
  saving.value = true
  try {
    const id = await createGroup(groupData)
    showGroupDrawer.value = false
    toast.success('Small group created')
    router.push(`/small-groups/${id}`)
  } catch (error) {
    console.error('Error creating small group:', error)
    toast.error('Failed to create the group. Please try again.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Toolbar -->
    <div class="shrink-0 flex items-center gap-2 pb-3">
      <div class="relative flex-1 min-w-0">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          v-model="searchQuery"
          type="search"
          :placeholder="t('search')"
          class="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>
      <button
        @click="showPrintPicker = true"
        :disabled="groups.length === 0"
        class="shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :title="t('printBlank')"
      >
        <Printer class="h-4 w-4" />
        <span class="hidden sm:inline">{{ t('printBlank') }}</span>
      </button>
      <button
        v-if="canManage('smallgroups')"
        @click="showGroupDrawer = true"
        class="shrink-0 inline-flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors"
      >
        <Plus class="h-4 w-4" />
        <span class="hidden sm:inline">{{ t('newGroup') }}</span>
      </button>
    </div>

    <!-- List -->
    <div class="flex-1 overflow-hidden flex relative">
      <div class="flex-1 overflow-y-auto">
        <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
          <div
            v-for="i in 4"
            :key="`skeleton-${i}`"
            class="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
          >
            <div class="aspect-[16/9] bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div class="p-4 space-y-3">
              <div class="flex items-center gap-2">
                <div class="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
              <div class="flex gap-1.5">
                <div class="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                <div class="h-6 w-28 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        <div
          v-else-if="filteredGroups.length === 0"
          class="p-8 text-center text-gray-500 dark:text-gray-400"
        >
          <UsersRound class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
          <p class="mb-4">
            {{ searchQuery ? 'No groups match your search.' : t('noGroups') }}
          </p>
          <button
            v-if="!searchQuery && canManage('smallgroups')"
            @click="showGroupDrawer = true"
            class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            {{ t('newGroup') }}
          </button>
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
          <SmallGroupCard
            v-for="group in filteredGroups"
            :key="group.firestoreId"
            :group="group"
            :members="members"
            @click="openGroup(group)"
          />
        </div>
      </div>

      <AddEditGroupDrawer
        v-model:show="showGroupDrawer"
        :members="members"
        :saving="saving"
        @save="handleSave"
      />
    </div>

    <!-- Which group to print a blank form for -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showPrintPicker"
          class="fixed inset-0 z-100 flex items-end sm:items-center sm:justify-center no-print"
        >
          <div
            class="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
            @click="showPrintPicker = false"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sg-print-picker-title"
            class="relative z-10 w-full sm:max-w-sm max-h-[80dvh] flex flex-col bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border-t sm:border border-gray-200 dark:border-gray-700"
          >
            <div
              class="shrink-0 flex items-start justify-between gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-gray-800"
            >
              <div class="min-w-0">
                <h3
                  id="sg-print-picker-title"
                  class="text-base font-bold text-gray-900 dark:text-white"
                >
                  {{ t('printBlank') }}
                </h3>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  The sheet is printed with this group's name and roster.
                </p>
              </div>
              <button
                @click="showPrintPicker = false"
                class="shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Close"
              >
                <X class="h-5 w-5" />
              </button>
            </div>

            <ul
              class="flex-1 min-h-0 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
            >
              <li v-for="group in groups" :key="group.firestoreId">
                <button
                  @click="printBlankFor(group)"
                  class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                >
                  <span
                    class="h-9 w-9 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center"
                  >
                    <UsersRound class="h-4 w-4" />
                  </span>
                  <span class="flex-1 min-w-0">
                    <span class="block text-sm font-medium text-gray-900 dark:text-white truncate">
                      {{ group.name }}
                    </span>
                    <span class="block text-xs text-gray-500 dark:text-gray-400">
                      {{ group.memberIds.length }} {{ t('members') }}
                    </span>
                  </span>
                  <Printer class="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
                </button>
              </li>
            </ul>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Mounted only while printing -->
    <div v-if="printGroup" class="print-area print-only">
      <SessionFormPrintable :group="printGroup" :members="members" />
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
