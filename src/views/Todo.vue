<script setup>
import { computed, ref, watch } from 'vue'
import {
  Check,
  ChevronDown,
  Menu,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SearchX,
  StopFill,
  Trash2,
} from '../icons'
import SearchBar from '../components/common/SearchBar.vue'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'
import TicketDrawer from '../components/todo/TicketDrawer.vue'
import { useTickets } from '../composables/useTickets'
import { useToast } from '../composables/useToast'
import {
  TICKET_KINDS,
  kindClasses,
  kindLabel,
  matchesTicketQuery,
  kindBorder,
  kindTextClasses,
  statusTextClasses,
  statusLabel,
} from '../utils/ticketUtils'
import { useAuth } from '../composables/useAuth'
import { usePermissions } from '../composables/usePermissions'
import { useDragReorder } from '../composables/useDragReorder'
import { getDisplayName } from '../utils/memberUtils'

const {
  loading,
  openTickets,
  closedTickets,
  openCountByKind,
  addTicket,
  setTicketStatus,
  reorderTickets,
  removeTicket,
} = useTickets()
const toast = useToast()

// Say which layer refused, rather than a generic "could not save" that sends
// you looking in the wrong place.
const failed = (error, fallback) => {
  console.error(error)
  const code = error?.code ? ` (${error.code})` : ''
  toast.error(
    error?.code === 'permission-denied'
      ? 'Firestore refused that write — check the rules on the tasks collection.'
      : `${fallback}${code}`
  )
}

const searchQuery = ref('')
const showDrawer = ref(false)
const kindFilter = ref('all')

// Everyone on this page is an administrator — the route sees to that — so
// taking a ticket needs no check beyond knowing who is asking.
const { user, displayName } = useAuth()
const { myMember } = usePermissions()
const myUid = computed(() => user.value?.uid || '')
const myName = computed(() => getDisplayName(myMember.value) || displayName.value)
const saving = ref(false)
const showClosed = ref(false)
// SearchBar collapses to an icon on a phone and leaves the open state to the
// parent; without this the icon is tappable but never expands.
const mobileSearchOpen = ref(false)
const pendingDelete = ref(null)

const matchesFilters = (t) =>
  (kindFilter.value === 'all' || t.kind === kindFilter.value) &&
  matchesTicketQuery(t, searchQuery.value)

const filteredOpen = computed(() => openTickets.value.filter(matchesFilters))
const filteredClosed = computed(() => closedTickets.value.filter(matchesFilters))

const nothingToShow = computed(() => !filteredOpen.value.length && !filteredClosed.value.length)

const handleSave = async (ticket) => {
  if (saving.value) return
  saving.value = true
  try {
    await addTicket(ticket)
    showDrawer.value = false
  } catch (error) {
    // The drawer stays open and keeps what was typed, so a failed save is not
    // also a lost one.
    failed(error, 'Could not add that ticket')
  } finally {
    saving.value = false
  }
}

// Dragging is only coherent over the whole list: reordering three rows that a
// filter happens to show says nothing about where they sit among the rest.
const canReorder = computed(() => kindFilter.value === 'all' && !searchQuery.value.trim())

// The list the rows actually render from. It follows the store except while a
// drag is in flight, when it is the thing being rearranged.
const dragList = ref([])

const { draggingIndex, dragTarget, dragHandle } = useDragReorder(
  () => dragList.value,
  (next) => {
    dragList.value = next
  }
)

watch(
  filteredOpen,
  (rows) => {
    if (draggingIndex.value === null) dragList.value = [...rows]
  },
  { immediate: true }
)

// Written once, on release — not on every swap under the finger.
watch(draggingIndex, async (now, before) => {
  if (before === null || now !== null) return
  try {
    await reorderTickets(dragList.value)
  } catch (error) {
    failed(error, 'Could not save that order')
  }
})

// Starting hands over who is asking, because starting is also taking.
const move = async (ticket, status) => {
  try {
    await setTicketStatus(ticket, status, { uid: myUid.value, name: myName.value })
  } catch (error) {
    failed(error, 'Could not update that ticket')
  }
}

const confirmDelete = async () => {
  const ticket = pendingDelete.value
  if (!ticket) return
  try {
    await removeTicket(ticket)
    toast.success('Ticket deleted')
  } catch (error) {
    failed(error, 'Could not delete that ticket')
  } finally {
    pendingDelete.value = null
  }
}
</script>

<template>
  <div class="flex h-full flex-col gap-3">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <div
        :class="[
          'min-w-0 flex-1',
          mobileSearchOpen ? 'hidden lg:block' : 'block',
        ]"
      >
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">To-do</h1>
        <p class="truncate text-xs text-gray-500 dark:text-gray-400">
          <template v-if="openTickets.length">
            {{ openTickets.length }} open &middot;
            <span v-for="(kind, i) in TICKET_KINDS" :key="kind.key">
              <template v-if="openCountByKind[kind.key]">
                <template v-if="i">, </template>
                {{ openCountByKind[kind.key] }} {{ kind.label.toLowerCase()
                }}{{ openCountByKind[kind.key] === 1 ? '' : 's' }}
              </template>
            </span>
          </template>
          <template v-else>Nothing open</template>
        </p>
      </div>
      <SearchBar
        v-model="searchQuery"
        v-model:open="mobileSearchOpen"
        placeholder="Search tickets — try “bug”"
      />
      <button
        type="button"
        @click="showDrawer = true"
        :class="[
          'shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90',
          mobileSearchOpen ? 'hidden lg:inline-flex' : 'inline-flex',
        ]"
        :style="{ background: 'var(--color-primary)' }"
      >
        <Plus class="h-4 w-4" />
        <span class="hidden sm:inline">New ticket</span>
      </button>
    </div>

    <!-- Kind pills. Counts are of what is open, which is what you are choosing
         between; the done pile keeps its own tally below. -->
    <div class="flex shrink-0 gap-1.5 overflow-x-auto pb-0.5">
      <button
        type="button"
        @click="kindFilter = 'all'"
        :aria-pressed="kindFilter === 'all'"
        :class="[
          'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
          kindFilter === 'all'
            ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
            : 'bg-gray-100 text-gray-500 hover:text-gray-700 dark:bg-gray-700 dark:text-gray-400 dark:hover:text-gray-100',
        ]"
      >
        All {{ openTickets.length }}
      </button>
      <button
        v-for="kind in TICKET_KINDS"
        :key="kind.key"
        type="button"
        @click="kindFilter = kind.key"
        :aria-pressed="kindFilter === kind.key"
        :class="[
          'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
          kindFilter === kind.key
            ? kindClasses(kind.key)
            : 'bg-gray-100 text-gray-500 hover:text-gray-700 dark:bg-gray-700 dark:text-gray-400 dark:hover:text-gray-100',
        ]"
      >
        {{ kind.label }} {{ openCountByKind[kind.key] || 0 }}
      </button>
    </div>

    <!-- List -->
    <div
      class="flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
    >
      <div v-if="loading" class="p-8 text-center text-gray-500 dark:text-gray-400">
        Loading tickets...
      </div>

      <div
        v-else-if="nothingToShow"
        class="flex flex-col items-center justify-center px-8 py-16 text-center text-gray-500 dark:text-gray-400"
      >
        <SearchX v-if="searchQuery" class="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
        <Check v-else class="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
        <p class="mb-1 text-lg">
          <template v-if="searchQuery">Nothing matches “{{ searchQuery }}”</template>
          <template v-else-if="kindFilter !== 'all'">
            No {{ kindLabel(kindFilter).toLowerCase() }}s open
          </template>
          <template v-else>Nothing on the list</template>
        </p>
        <p class="text-sm">
          <template v-if="searchQuery">Try a word from the ticket, a kind, or “urgent”.</template>
          <template v-else-if="kindFilter !== 'all'">Nothing filed under that kind yet.</template>
          <template v-else>Add the first thing that needs doing.</template>
        </p>
      </div>

      <template v-else>
        <ul class="divide-y divide-gray-100 dark:divide-gray-700">
          <li
            v-for="(ticket, index) in dragList"
            :key="ticket.id"
            v-bind="dragTarget(index)"
            :class="[
              'flex items-start gap-2 border-l-4 bg-white py-3 pl-2 pr-2 dark:bg-gray-800',
              kindBorder(ticket.kind),
              draggingIndex === index ? 'shadow-lg ring-2 ring-primary/40' : '',
            ]"
          >
            <!-- Only the grip starts a drag, so the row's buttons stay buttons. -->
            <span
              v-if="canReorder"
              v-bind="dragHandle(index)"
              aria-label="Drag to reorder"
              class="mt-0.5 shrink-0 cursor-grab text-gray-300 transition-colors hover:text-gray-500 active:cursor-grabbing dark:text-gray-600 dark:hover:text-gray-400"
            >
              <Menu class="h-4 w-4" />
            </span>

            <div class="min-w-0 flex-1">
              <p class="text-sm text-gray-900 dark:text-white">{{ ticket.title }}</p>

              <!-- One quiet line instead of three badges. -->
              <p class="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px]">
                <span :class="['font-semibold', kindTextClasses(ticket.kind)]">
                  {{ kindLabel(ticket.kind) }}
                </span>
                <span class="text-gray-300 dark:text-gray-600">·</span>
                <span :class="statusTextClasses(ticket.status)">
                  {{ statusLabel(ticket.status) }}
                </span>
                <template v-if="ticket.assigneeUid">
                  <span class="text-gray-300 dark:text-gray-600">·</span>
                  <span class="text-gray-500 dark:text-gray-400">
                    {{ ticket.assigneeUid === myUid ? 'You' : ticket.assigneeName }}
                  </span>
                </template>
              </p>

              <p
                v-if="ticket.details"
                class="mt-1 whitespace-pre-line text-xs text-gray-500 dark:text-gray-400"
              >
                {{ ticket.details }}
              </p>
            </div>

            <!-- Play, pause, stop, done: four icons, no words. The state is
                 already written on the meta line above, so labelling the
                 buttons as well said everything twice. -->
            <div class="flex shrink-0 items-center gap-1">
              <button
                v-if="ticket.status === 'open'"
                type="button"
                @click="move(ticket, 'doing')"
                aria-label="Start — take this and begin"
                title="Start"
                class="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-primary/10 hover:text-primary dark:hover:bg-primary-light/10 dark:hover:text-primary-light"
              >
                <Play class="h-3.5 w-3.5" />
              </button>

              <template v-else>
                <button
                  type="button"
                  @click="move(ticket, 'done')"
                  aria-label="Done — this is finished"
                  title="Done"
                  class="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/30 dark:hover:text-green-400"
                >
                  <Check class="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  @click="move(ticket, ticket.status === 'doing' ? 'paused' : 'doing')"
                  :aria-label="ticket.status === 'doing' ? 'Pause' : 'Resume'"
                  :title="ticket.status === 'doing' ? 'Pause' : 'Resume'"
                  class="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                >
                  <Pause v-if="ticket.status === 'doing'" class="h-3.5 w-3.5" />
                  <Play v-else class="h-3.5 w-3.5" />
                </button>
                <!-- Stop, not a cross: alongside Play and Pause it reads as the
                     third transport control, which is exactly what it is. -->
                <button
                  type="button"
                  @click="move(ticket, 'open')"
                  aria-label="Stop and put this back for anyone to take"
                  title="Stop"
                  class="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                >
                  <StopFill class="h-3.5 w-3.5" />
                </button>
              </template>

              <button
                type="button"
                @click="pendingDelete = ticket"
                :aria-label="`Delete “${ticket.title}”`"
                title="Delete"
                class="rounded-full p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        </ul>

        <!-- Closed, folded away: a backlog is read for what is left. -->
        <div v-if="filteredClosed.length" class="border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            @click="showClosed = !showClosed"
            :aria-expanded="showClosed"
            class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400"
          >
            <ChevronDown
              class="h-4 w-4 transition-transform"
              :class="showClosed ? 'rotate-180' : ''"
            />
            {{ filteredClosed.length }} done
          </button>
          <ul v-if="showClosed" class="divide-y divide-gray-100 dark:divide-gray-700">
            <li
              v-for="ticket in filteredClosed"
              :key="ticket.id"
              class="flex items-start gap-3 px-3 py-2.5"
            >
              <button
                type="button"
                @click="move(ticket, 'open')"
                :aria-label="`Reopen “${ticket.title}”`"
                title="Reopen"
                class="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200"
              >
                <RotateCcw class="h-3.5 w-3.5" />
              </button>
              <p class="min-w-0 flex-1 text-sm text-gray-400 line-through dark:text-gray-500">
                {{ ticket.title }}
              </p>
              <button
                type="button"
                @click="pendingDelete = ticket"
                :aria-label="`Delete “${ticket.title}”`"
                class="shrink-0 p-1 text-gray-300 transition-colors hover:text-red-600 dark:text-gray-600 dark:hover:text-red-400"
              >
                <Trash2 class="h-4 w-4" />
              </button>
            </li>
          </ul>
        </div>
      </template>
    </div>

    <TicketDrawer v-model:show="showDrawer" :saving="saving" @save="handleSave" />

    <ConfirmationModal
      :show="Boolean(pendingDelete)"
      title="Delete ticket"
      :message="`Delete “${pendingDelete?.title}”? This cannot be undone.`"
      confirm-text="Delete"
      confirm-button-class="bg-red-600 text-white hover:bg-red-700"
      @update:show="pendingDelete = null"
      @confirm="confirmDelete"
      @cancel="pendingDelete = null"
    />
  </div>
</template>
