<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Users,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  Wallet,
  HeartHandshake,
  ClipboardCheck,
  FileText,
  Bell,
  Image,
  Link2,
  Database,
} from 'lucide-vue-next'
import { subscribeToMembers } from '../api/membersService'
import { subscribeToTransactions } from '../api/financeService'
import { subscribeToEvents } from '../api/eventsService'
import { subscribeToAttendance } from '../api/attendanceService'
import { subscribeToMinutes } from '../api/minutesService'
import { subscribeToPrayerConcerns } from '../api/prayerConcernsService'
import { subscribeToLinks } from '../api/linksService'
import { subscribeToAlbums } from '../api/galleryService'
import { subscribeToNotifications } from '../api/notifyService'

const members = ref([])
const transactions = ref([])
const events = ref([])
const attendance = ref([])
const minutes = ref([])
const prayerConcerns = ref([])
const links = ref([])
const albums = ref([])
const notifications = ref([])

const unsubs = []
onMounted(() => {
  unsubs.push(subscribeToMembers((d) => (members.value = d)))
  unsubs.push(subscribeToTransactions((d) => (transactions.value = d)))
  unsubs.push(subscribeToEvents((d) => (events.value = d)))
  unsubs.push(subscribeToAttendance((d) => (attendance.value = d)))
  unsubs.push(subscribeToMinutes((d) => (minutes.value = d)))
  unsubs.push(subscribeToPrayerConcerns((d) => (prayerConcerns.value = d)))
  unsubs.push(subscribeToLinks((d) => (links.value = d)))
  unsubs.push(subscribeToAlbums((d) => (albums.value = d)))
  unsubs.push(subscribeToNotifications((d) => (notifications.value = d)))
})
onUnmounted(() => unsubs.forEach((u) => u && u()))

// ---- Finance summaries ----
const income = computed(() =>
  transactions.value
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + (Number(t.amount) || 0), 0)
)
const expenses = computed(() =>
  transactions.value
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + (Number(t.amount) || 0), 0)
)
const net = computed(() => income.value - expenses.value)
const peso = (n) => '₱' + Math.abs(n).toLocaleString()

// Top categories as {label, type, amount, pct}
const categoryBars = computed(() => {
  const groups = {}
  for (const t of transactions.value) {
    const key = `${t.category || 'Uncategorized'}|${t.type}`
    groups[key] = (groups[key] || 0) + (Number(t.amount) || 0)
  }
  const rows = Object.entries(groups)
    .map(([key, amount]) => {
      const [label, type] = key.split('|')
      return { label, type, amount }
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6)
  const max = rows[0]?.amount || 1
  return rows.map((r) => ({ ...r, pct: Math.max(4, Math.round((r.amount / max) * 100)) }))
})

// ---- People ----
const officialMembers = computed(() => members.value.filter((m) => m.isMember))
const recentMembers = computed(() => members.value.slice(0, 5))
const displayName = (m) =>
  [m.firstName, m.lastName].filter(Boolean).join(' ') || m.nickname || 'Unnamed'

// ---- Activity ----
const latestAttendance = computed(() =>
  [...attendance.value].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]
)
const latestMinutes = computed(() =>
  [...minutes.value].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]
)
const recentNotifications = computed(() => notifications.value.slice(0, 4))

const formatDate = (str) => {
  if (!str) return '—'
  const d = new Date(str)
  return isNaN(d) ? str : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
const notifTime = (ts) => {
  if (!ts?.toDate) return 'just now'
  return ts.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ---- Collections overview ----
const collections = computed(() => [
  { name: 'members', count: members.value.length, icon: Users },
  { name: 'events', count: events.value.length, icon: CalendarDays },
  { name: 'finances', count: transactions.value.length, icon: Wallet },
  { name: 'attendance', count: attendance.value.length, icon: ClipboardCheck },
  { name: 'minutes', count: minutes.value.length, icon: FileText },
  { name: 'prayerConcerns', count: prayerConcerns.value.length, icon: HeartHandshake },
  { name: 'links', count: links.value.length, icon: Link2 },
  { name: 'gallery', count: albums.value.length, icon: Image },
  { name: 'notifications', count: notifications.value.length, icon: Bell },
])
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="flex flex-col gap-4 pb-10">
      <!-- Stat tiles -->
      <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <router-link
          to="/members"
          class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 hover:border-primary/40 transition-colors"
        >
          <div class="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-gray-400">
            <Users class="w-3.5 h-3.5 text-primary dark:text-primary-light" /> People
          </div>
          <div class="mt-1.5 text-2xl font-black text-gray-900 dark:text-white tabular-nums">
            {{ members.length }}
          </div>
          <div class="text-[10px] font-bold text-gray-400">
            {{ officialMembers.length }} member{{ officialMembers.length === 1 ? '' : 's' }} ·
            {{ members.length - officialMembers.length }} guest{{ members.length - officialMembers.length === 1 ? '' : 's' }}
          </div>
        </router-link>

        <router-link
          to="/events"
          class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 hover:border-primary/40 transition-colors"
        >
          <div class="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-gray-400">
            <CalendarDays class="w-3.5 h-3.5 text-primary dark:text-primary-light" /> Events
          </div>
          <div class="mt-1.5 text-2xl font-black text-gray-900 dark:text-white tabular-nums">
            {{ events.length }}
          </div>
          <div class="text-[10px] font-bold text-gray-400">
            {{ events.length ? 'scheduled' : 'none yet' }}
          </div>
        </router-link>

        <router-link
          to="/finances"
          class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 hover:border-primary/40 transition-colors"
        >
          <div class="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-gray-400">
            <TrendingUp class="w-3.5 h-3.5 text-primary dark:text-primary-light" /> Income
          </div>
          <div class="mt-1.5 text-2xl font-black text-gray-900 dark:text-white tabular-nums">
            {{ peso(income) }}
          </div>
          <div class="text-[10px] font-bold text-gray-400">
            {{ transactions.filter((t) => t.type === 'income').length }} record{{ transactions.filter((t) => t.type === 'income').length === 1 ? '' : 's' }}
          </div>
        </router-link>

        <router-link
          to="/finances"
          class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 hover:border-primary/40 transition-colors"
        >
          <div class="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-gray-400">
            <TrendingDown class="w-3.5 h-3.5 text-[#bc1c09]" /> Expenses
          </div>
          <div class="mt-1.5 text-2xl font-black text-gray-900 dark:text-white tabular-nums">
            {{ peso(expenses) }}
          </div>
          <div class="text-[10px] font-bold text-gray-400">
            {{ transactions.filter((t) => t.type === 'expense').length }} record{{ transactions.filter((t) => t.type === 'expense').length === 1 ? '' : 's' }}
          </div>
        </router-link>

        <router-link
          to="/finances"
          class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 hover:border-primary/40 transition-colors"
        >
          <div class="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-gray-400">
            <Wallet class="w-3.5 h-3.5 text-primary dark:text-primary-light" /> Net
          </div>
          <div
            class="mt-1.5 text-2xl font-black tabular-nums"
            :class="net < 0 ? 'text-[#bc1c09]' : 'text-gray-900 dark:text-white'"
          >
            {{ net < 0 ? '−' : '' }}{{ peso(net) }}
          </div>
          <div class="text-[10px] font-bold text-gray-400">
            {{ net < 0 ? 'spending exceeds income' : 'on the positive side' }}
          </div>
        </router-link>

        <router-link
          to="/prayer-concerns"
          class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 hover:border-primary/40 transition-colors"
        >
          <div class="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-gray-400">
            <HeartHandshake class="w-3.5 h-3.5 text-primary dark:text-primary-light" /> Prayers
          </div>
          <div class="mt-1.5 text-2xl font-black text-gray-900 dark:text-white tabular-nums">
            {{ prayerConcerns.length }}
          </div>
          <div class="text-[10px] font-bold text-gray-400">
            {{ prayerConcerns.length ? 'concerns listed' : 'none yet' }}
          </div>
        </router-link>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Finance breakdown -->
        <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-[10px] font-black uppercase tracking-widest text-primary">
              Finances by category
            </h3>
            <div class="flex gap-3 text-[9px] font-black uppercase tracking-widest text-gray-400">
              <span class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-sm bg-primary"></span> In
              </span>
              <span class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-sm bg-[#bc1c09]"></span> Out
              </span>
            </div>
          </div>
          <div v-if="categoryBars.length" class="flex flex-col gap-2.5">
            <div
              v-for="bar in categoryBars"
              :key="bar.label + bar.type"
              class="grid grid-cols-[80px_1fr] items-center gap-2.5"
            >
              <span class="text-[11px] font-bold text-gray-500 dark:text-gray-400 text-right truncate">
                {{ bar.label }}
              </span>
              <span class="flex items-center gap-2">
                <span
                  class="h-3 rounded-r"
                  :class="bar.type === 'income' ? 'bg-primary' : 'bg-[#bc1c09]'"
                  :style="{ width: bar.pct + '%' }"
                ></span>
                <span class="text-[11px] font-black text-gray-700 dark:text-gray-300 tabular-nums whitespace-nowrap">
                  {{ bar.type === 'income' ? '+' : '−' }}{{ peso(bar.amount) }}
                </span>
              </span>
            </div>
          </div>
          <p v-else class="py-6 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">
            No transactions yet
          </p>
        </div>

        <!-- People -->
        <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-[10px] font-black uppercase tracking-widest text-primary">People</h3>
            <router-link
              to="/members"
              class="text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-primary transition-colors"
            >
              View all
            </router-link>
          </div>
          <div v-if="recentMembers.length" class="flex flex-col">
            <div
              v-for="m in recentMembers"
              :key="m.firestoreId || m.id"
              class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700/60 last:border-b-0"
            >
              <div class="min-w-0">
                <p class="text-[12px] font-black text-gray-900 dark:text-white truncate">
                  {{ displayName(m) }}
                </p>
                <p class="text-[10px] font-bold text-gray-400 truncate">
                  {{ m.nickname ? '@' + m.nickname : '' }}{{ m.civilStatus ? (m.nickname ? ' · ' : '') + m.civilStatus : '' }}
                </p>
              </div>
              <span
                class="shrink-0 text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
                :class="m.isMember
                  ? 'bg-primary/10 text-primary dark:bg-primary-light/10 dark:text-primary-light'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'"
              >
                {{ m.isMember ? 'Member' : 'Guest' }}
              </span>
            </div>
          </div>
          <p v-else class="py-6 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">
            No members yet
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <!-- Latest attendance -->
        <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 class="text-[10px] font-black uppercase tracking-widest text-primary mb-3">
            Latest attendance
          </h3>
          <template v-if="latestAttendance">
            <p class="text-sm font-black text-gray-900 dark:text-white">
              {{ latestAttendance.eventTitle || 'Session' }}
            </p>
            <p class="text-[10px] font-bold text-gray-400 mt-1">
              {{ formatDate(latestAttendance.date) }} ·
              {{ latestAttendance.totalAttendees }} present
            </p>
          </template>
          <p v-else class="text-[10px] font-black uppercase tracking-widest text-gray-400 py-3">
            No sessions yet
          </p>
        </div>

        <!-- Latest minutes -->
        <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 class="text-[10px] font-black uppercase tracking-widest text-primary mb-3">
            Latest minutes
          </h3>
          <template v-if="latestMinutes">
            <p class="text-sm font-black text-gray-900 dark:text-white">
              {{ latestMinutes.title || 'Untitled' }}
            </p>
            <p class="text-[10px] font-bold text-gray-400 mt-1">
              {{ formatDate(latestMinutes.date) }}
              {{ latestMinutes.location ? '· ' + latestMinutes.location : '' }}
            </p>
          </template>
          <p v-else class="text-[10px] font-black uppercase tracking-widest text-gray-400 py-3">
            No minutes yet
          </p>
        </div>

        <!-- Recent notifications -->
        <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 class="text-[10px] font-black uppercase tracking-widest text-primary mb-3">
            Recent notifications
          </h3>
          <div v-if="recentNotifications.length" class="flex flex-col gap-2">
            <div v-for="n in recentNotifications" :key="n.id" class="min-w-0">
              <p class="text-[12px] font-black text-gray-900 dark:text-white truncate">{{ n.title }}</p>
              <p class="text-[10px] font-bold text-gray-400">{{ notifTime(n.sentAt) }}</p>
            </div>
          </div>
          <p v-else class="text-[10px] font-black uppercase tracking-widest text-gray-400 py-3">
            Nothing sent yet
          </p>
        </div>
      </div>

      <!-- Collections overview -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
        <div class="flex items-center gap-2 mb-4">
          <Database class="w-3.5 h-3.5 text-primary dark:text-primary-light" />
          <h3 class="text-[10px] font-black uppercase tracking-widest text-primary">Database collections</h3>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <div
            v-for="c in collections"
            :key="c.name"
            class="flex items-center justify-between rounded-xl border px-3 py-2.5"
            :class="c.count
              ? 'border-gray-200 dark:border-gray-700'
              : 'border-dashed border-gray-200 dark:border-gray-700 opacity-50'"
          >
            <span class="flex items-center gap-2 min-w-0">
              <component :is="c.icon" class="w-3.5 h-3.5 shrink-0 text-gray-400" />
              <span class="text-[11px] font-mono font-bold text-gray-600 dark:text-gray-300 truncate">
                {{ c.name }}
              </span>
            </span>
            <span class="text-[11px] font-black tabular-nums" :class="c.count ? 'text-gray-900 dark:text-white' : 'text-gray-400'">
              {{ c.count }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
