<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ChevronDown, History, SearchX } from '../icons'
import SearchBar from '../components/common/SearchBar.vue'
import { fetchOlderAudit, subscribeToRecentAudit, AUDIT_PAGE_SIZE } from '../api/auditLogService'

// Who changed what, newest first. Read-only on purpose: an entry that could be
// corrected from here would be a record of what somebody later wished had
// happened.
//
// One search bar rather than filters: a name, a page, a verb or a field —
// "Ana", "members", "deleted", "contactNumber" — narrows the same list.

const recent = ref([])
const older = ref([])
const loading = ref(true)
const loadingOlder = ref(false)
const exhausted = ref(false)
let unsubscribe = null

onMounted(() => {
  unsubscribe = subscribeToRecentAudit((entries) => {
    recent.value = entries
    loading.value = false
  })
})
onUnmounted(() => unsubscribe?.())

const entries = computed(() => {
  const seen = new Set(recent.value.map((e) => e.id))
  return [...recent.value, ...older.value.filter((e) => !seen.has(e.id))]
})

const loadOlder = async () => {
  const last = entries.value[entries.value.length - 1]
  if (!last || loadingOlder.value) return
  loadingOlder.value = true
  try {
    const page = await fetchOlderAudit(last)
    older.value = [...older.value, ...page]
    if (page.length < AUDIT_PAGE_SIZE) exhausted.value = true
  } finally {
    loadingOlder.value = false
  }
}

/* ------------------------------------------------------------ wording */

// What each collection is, in the words the app's own pages use.
const PLACES = {
  members: 'People',
  events: 'Events',
  recurringSchedules: 'Recurring events',
  attendance: 'Attendance',
  minutes: 'Minutes',
  tasks: 'Tasks',
  smallGroups: 'Small groups',
  sgSessions: 'Small group sessions',
  sgSessionPhotos: 'Small group photos',
  songs: 'Songs',
  worshipLineups: 'Schedules',
  servicePlans: 'Service plans',
  gallery_albums: 'Gallery',
  gallery_photos: 'Gallery',
  ledgerEntries: 'Finances',
  prayerConcerns: 'Prayer concerns',
  links: 'Links',
  ministries: 'Ministries',
  memberTags: 'Tags',
  rolePermissions: 'Roles',
  admins: 'Administrators',
  appSettings: 'Settings',
  memberClaims: 'Account links',
  notifications: 'Notifications',
}

const placeOf = (entry) =>
  String(entry.collection || '')
    .split(', ')
    .filter(Boolean)
    .map((c) => PLACES[c] || c)
    .join(', ') || (entry.source === 'mcp' ? 'Connector' : '')

const VERBS = { create: 'added', set: 'saved', update: 'changed', delete: 'deleted', batch: 'changed' }

const who = (entry) => entry.actorName || entry.actorEmail || 'Someone signed out'

const what = (entry) => {
  if (entry.count > 1) return `${entry.count} ${placeOf(entry).toLowerCase() || 'records'}`
  return entry.label || (entry.tool ? entry.tool.replace(/_/g, ' ') : placeOf(entry) || 'a record')
}

const timeOf = (date) => date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

const dayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const dayLabel = (date) => {
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (dayKey(date) === dayKey(today)) return 'Today'
  if (dayKey(date) === dayKey(yesterday)) return 'Yesterday'
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
  })
}

/* ------------------------------------------------------------- search */

const searchQuery = ref('')
const searchOpen = ref(false)

const haystack = (entry) =>
  [
    who(entry),
    entry.actorEmail,
    VERBS[entry.action],
    entry.action,
    entry.action === 'delete' ? 'removed' : '',
    entry.action === 'create' ? 'new created' : '',
    what(entry),
    placeOf(entry),
    entry.collection,
    entry.page,
    entry.tool,
    entry.source === 'mcp' ? 'mcp claude connector' : '',
    ...(entry.fields || []),
    ...Object.values(entry.changes || {}),
    dayLabel(entry.at),
    dayKey(entry.at),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

const filtered = computed(() => {
  const terms = searchQuery.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return entries.value
  return entries.value.filter((entry) => {
    const text = haystack(entry)
    return terms.every((term) => text.includes(term))
  })
})

const days = computed(() => {
  const groups = []
  let current = null
  filtered.value.forEach((entry) => {
    const key = dayKey(entry.at)
    if (!current || current.key !== key) {
      current = { key, label: dayLabel(entry.at), entries: [] }
      groups.push(current)
    }
    current.entries.push(entry)
  })
  return groups
})

// One open at a time: the detail is a handful of lines, and two open at once
// is two sets of field names to tell apart.
const openId = ref(null)
const toggle = (entry) => {
  openId.value = openId.value === entry.id ? null : entry.id
}

const ACTION_DOT = {
  create: 'bg-primary dark:bg-primary-light',
  delete: 'bg-red-500',
}
</script>

<template>
  <div class="flex h-full flex-col gap-3">
    <div class="flex items-center gap-3">
      <div :class="['min-w-0 flex-1', searchOpen ? 'hidden lg:block' : 'block']">
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">Audit log</h1>
        <p class="truncate text-xs text-gray-500 dark:text-gray-400">Every change, and who made it</p>
      </div>
      <SearchBar
        v-model="searchQuery"
        v-model:open="searchOpen"
        placeholder="Search — a name, “deleted”, “people”"
      />
    </div>

    <div
      class="flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
    >
      <div v-if="loading" class="divide-y divide-gray-100 dark:divide-gray-700">
        <div v-for="i in 8" :key="i" class="space-y-2 px-4 py-3">
          <div class="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-600"></div>
          <div class="h-3 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-600"></div>
        </div>
      </div>

      <div
        v-else-if="!days.length"
        class="flex flex-col items-center justify-center px-8 py-16 text-center text-gray-500 dark:text-gray-400"
      >
        <SearchX v-if="searchQuery" class="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
        <History v-else class="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
        <p class="mb-1 text-lg">
          {{ searchQuery ? `Nothing matches “${searchQuery}”` : 'Nothing recorded yet' }}
        </p>
        <p class="text-sm">
          {{
            searchQuery
              ? 'Only what has been loaded is searched — load older entries to look further back.'
              : 'Changes appear here the moment anyone makes one.'
          }}
        </p>
      </div>

      <template v-else>
        <section v-for="day in days" :key="day.key">
          <h2
            class="sticky top-0 z-10 border-b border-gray-200 bg-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
          >
            {{ day.label }}
          </h2>
          <ul class="divide-y divide-gray-100 dark:divide-gray-700">
            <li v-for="entry in day.entries" :key="entry.id">
              <button
                type="button"
                @click="toggle(entry)"
                :aria-expanded="openId === entry.id"
                class="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40"
              >
                <span
                  :class="[
                    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                    ACTION_DOT[entry.action] || 'bg-gray-300 dark:bg-gray-500',
                  ]"
                ></span>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm text-gray-900 dark:text-white">
                    <span class="font-semibold">{{ who(entry) }}</span>
                    {{ VERBS[entry.action] || entry.action }}
                    <span class="font-medium">{{ what(entry) }}</span>
                  </span>
                  <span class="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
                    {{ placeOf(entry) }}
                    <template v-if="entry.fields?.length && entry.action !== 'create'">
                      · {{ entry.fields.join(', ') }}
                    </template>
                  </span>
                </span>
                <span class="shrink-0 text-xs tabular-nums text-gray-400 dark:text-gray-500">
                  {{ timeOf(entry.at) }}
                </span>
              </button>

              <!-- The detail: every field written and what it was written as. -->
              <div
                v-if="openId === entry.id"
                class="space-y-2 bg-gray-50 px-4 pb-3 pl-9 pt-1 text-xs dark:bg-gray-900/30"
              >
                <dl v-if="Object.keys(entry.changes || {}).length" class="space-y-1">
                  <div v-for="(value, field) in entry.changes" :key="field" class="flex gap-2">
                    <dt class="w-28 shrink-0 truncate font-medium text-gray-500 dark:text-gray-400">
                      {{ field }}
                    </dt>
                    <dd class="min-w-0 flex-1 break-words text-gray-800 dark:text-gray-200">{{ value }}</dd>
                  </div>
                </dl>
                <p class="text-gray-400 dark:text-gray-500">
                  <template v-if="entry.actorEmail">{{ entry.actorEmail }} · </template>
                  <template v-if="entry.source === 'mcp'">through the connector · </template>
                  <template v-if="entry.page">from {{ entry.page }} · </template>
                  {{ entry.path || (entry.docIds || []).length + ' records' }}
                </p>
              </div>
            </li>
          </ul>
        </section>

        <button
          v-if="!exhausted && entries.length >= AUDIT_PAGE_SIZE"
          type="button"
          @click="loadOlder"
          :disabled="loadingOlder"
          class="flex w-full items-center justify-center gap-1.5 border-t border-gray-100 py-3 text-sm font-medium text-primary disabled:opacity-50 dark:border-gray-700 dark:text-primary-light"
        >
          <ChevronDown class="h-4 w-4" />
          {{ loadingOlder ? 'Loading…' : 'Load older' }}
        </button>
      </template>
    </div>
  </div>
</template>
