<script setup>
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Globe,
  HandHeart,
  KeyRound,
  Mail,
  Repeat,
  ShieldCheck,
  Tag,
} from '../icons'
import RecurringEventsAdmin from '../components/settings/RecurringEventsAdmin.vue'
import MemberLinkAdmin from '../components/settings/MemberLinkAdmin.vue'
import RolePermissionsAdmin from '../components/settings/RolePermissionsAdmin.vue'
import MinistriesAdmin from '../components/settings/MinistriesAdmin.vue'
import MemberTagsAdmin from '../components/settings/MemberTagsAdmin.vue'
import ChurchSettings from '../components/settings/ChurchSettings.vue'
import EmailDigestAdmin from '../components/settings/EmailDigestAdmin.vue'
import LandingPageAdmin from '../components/settings/LandingPageAdmin.vue'
import { useAppSettings } from '../composables/useAppSettings'
import { useVersionCheck } from '../composables/useVersionCheck'
import { useMediaQuery } from '../composables/useMediaQuery'
import { useRecurringSchedules } from '../composables/useRecurringSchedules'
import { useMinistries } from '../composables/useMinistries'
import { useMemberClaims } from '../composables/useMemberClaims'
import { useLabelMarks } from '../composables/useLabelMarks'
import { useMembers } from '../composables/useMembers'

// Settings is a list of places, not a strip of tabs.
//
// Eight tabs in a row was a strip that scrolled sideways on a phone, so half of
// what Settings could do sat off the edge of the screen with nothing to say it
// was there, and the tab it opened on was the fourth one. Now a phone opens on
// every section at once, grouped by what it is about, each row saying where it
// stands — "3 on the calendar", "2 requests waiting" — so the one that needs
// attention is visible before anything is opened. A wide screen keeps the list
// down the side and the open section beside it.
//
// The section lives in the URL (?section=), so a refresh, the back button and
// a link someone sends all land in the same place. The old ?tab= links still
// work.

const route = useRoute()
const router = useRouter()
const isDesktop = useMediaQuery('(min-width: 1024px)')

const { church } = useAppSettings()
const { schedules } = useRecurringSchedules()
const { ministries } = useMinistries()
const { pendingClaims } = useMemberClaims()
const { tagRecords } = useLabelMarks()
const { members } = useMembers()

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

const tagCount = computed(() => {
  const names = new Set(tagRecords.value.map((t) => String(t.name || '').toLowerCase()))
  members.value.forEach((m) => (m.tags || []).forEach((t) => names.add(String(t).toLowerCase())))
  names.delete('')
  return names.size
})

const GROUPS = computed(() => [
  {
    label: 'Church',
    items: [
      {
        key: 'church',
        label: 'Church details',
        icon: Building2,
        status: church.value?.shortName || church.value?.name || 'Name, contacts and categories',
        component: ChurchSettings,
      },
      {
        key: 'landing',
        label: 'Public page',
        icon: Globe,
        status: 'What visitors see before signing in',
        component: LandingPageAdmin,
      },
    ],
  },
  {
    label: 'Calendar',
    items: [
      {
        key: 'schedule',
        label: 'Recurring events',
        icon: Repeat,
        status: `${schedules.value.filter((s) => s.enabled).length} on the calendar`,
        component: RecurringEventsAdmin,
      },
    ],
  },
  {
    label: 'People',
    items: [
      {
        key: 'ministries',
        label: 'Ministries',
        icon: HandHeart,
        status: plural(ministries.value.length, 'ministry', 'ministries'),
        component: MinistriesAdmin,
      },
      {
        key: 'tags',
        label: 'Tags',
        icon: Tag,
        status: plural(tagCount.value, 'tag'),
        component: MemberTagsAdmin,
      },
      {
        key: 'accounts',
        label: 'Account links & admins',
        icon: KeyRound,
        status: pendingClaims.value.length
          ? plural(pendingClaims.value.length, 'request waiting', 'requests waiting')
          : 'Who each sign-in belongs to',
        attention: pendingClaims.value.length > 0,
        component: MemberLinkAdmin,
      },
    ],
  },
  {
    label: 'Access',
    items: [
      {
        key: 'roles',
        label: 'Roles',
        icon: ShieldCheck,
        status: 'What each ministry can see and change',
        component: RolePermissionsAdmin,
      },
    ],
  },
  {
    label: 'Notifications',
    items: [
      {
        key: 'email',
        label: 'Email digest',
        icon: Mail,
        status: 'Summaries sent by email',
        component: EmailDigestAdmin,
      },
    ],
  },
])

const ITEMS = computed(() => GROUPS.value.flatMap((g) => g.items))

const requested = computed(() => {
  const key = route.query.section || route.query.tab
  return ITEMS.value.some((item) => item.key === key) ? key : ''
})

// A phone with nothing chosen shows the list; a desktop always shows a section
// beside it, so it falls back to the first rather than an empty pane.
const activeKey = computed(() => requested.value || (isDesktop.value ? 'church' : ''))
const active = computed(() => ITEMS.value.find((item) => item.key === activeKey.value) || null)

// ?tab= is how the old tabs linked; rewrite it to ?section= once, quietly.
watch(
  () => route.query.tab,
  (tab) => {
    if (!tab) return
    const { tab: _drop, ...rest } = route.query
    router.replace({ query: { ...rest, section: tab } })
  },
  { immediate: true }
)

// Opening a section pushes rather than replaces, so a phone's back gesture
// returns to the list — which is where "back" means on a phone.
const openSection = (key) => {
  if (key === activeKey.value) return
  router.push({ query: { ...route.query, section: key } })
}

const backToList = () => {
  const { section: _drop, ...rest } = route.query
  router.push({ query: rest })
}

// Stamped in from package.json by vite's define. Shown at the foot of
// settings because the app is installed as a PWA: when someone reports a bug
// from their phone, the first thing to establish is which build they are
// actually running, and a cached service worker can be well behind.
const appVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
const { open: openWhatsNew } = useVersionCheck()
</script>

<template>
  <div class="h-full lg:flex lg:gap-4">
    <!-- The list. The whole page on a phone until a section is opened; a
         column of its own on a desktop. -->
    <nav
      v-if="isDesktop || !active"
      aria-label="Settings sections"
      class="h-full overflow-y-auto lg:w-72 lg:shrink-0"
    >
      <h1 class="mb-3 text-xl font-bold text-gray-900 dark:text-white">Settings</h1>

      <div v-for="group in GROUPS" :key="group.label" class="mb-4">
        <h2
          class="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500"
        >
          {{ group.label }}
        </h2>
        <ul
          class="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800"
        >
          <li v-for="item in group.items" :key="item.key">
            <button
              type="button"
              @click="openSection(item.key)"
              :aria-current="activeKey === item.key ? 'page' : undefined"
              :class="[
                'flex w-full items-center gap-3 px-3 py-3 text-left transition-colors',
                activeKey === item.key && isDesktop
                  ? 'bg-primary/5 dark:bg-primary-light/10'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50',
              ]"
            >
              <span
                :class="[
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  activeKey === item.key && isDesktop
                    ? 'bg-primary text-white dark:bg-primary-light'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300',
                ]"
              >
                <component :is="item.icon" class="h-4.5 w-4.5" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-gray-900 dark:text-white">
                  {{ item.label }}
                </span>
                <span
                  :class="[
                    'block truncate text-xs',
                    item.attention
                      ? 'font-semibold text-amber-600 dark:text-amber-400'
                      : 'text-gray-500 dark:text-gray-400',
                  ]"
                >
                  {{ item.status }}
                </span>
              </span>
              <ChevronRight class="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
            </button>
          </li>
        </ul>
      </div>

      <!-- Which build this is. Under the list rather than inside a section,
           because a bug report can come from any of them and the version is
           the first question asked. -->
      <p class="pb-4 text-center text-xs text-gray-400 dark:text-gray-500">
        UEC Church v{{ appVersion }} &middot;
        <button
          @click="openWhatsNew"
          class="underline underline-offset-2 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
        >
          What's new
        </button>
      </p>
    </nav>

    <!-- The open section. A plain block scroller, deliberately not a flex
         column: a flex item shrinks to fit, and the sections are
         overflow-hidden for their rounded corners, so a tall one was clipped
         with nothing to scroll. -->
    <main v-if="active" class="h-full min-w-0 flex-1 overflow-y-auto pb-4">
      <!-- The way back, on a phone only. The section's own card carries its
           name, so this says where back goes rather than repeating it. -->
      <button
        v-if="!isDesktop"
        type="button"
        @click="backToList"
        class="-ml-1 mb-2 flex items-center gap-1 rounded-lg px-1 py-2 text-sm font-medium text-gray-600 dark:text-gray-300"
      >
        <ArrowLeft class="h-5 w-5" />
        Settings
      </button>

      <KeepAlive>
        <component :is="active.component" :key="active.key" />
      </KeepAlive>
    </main>
  </div>
</template>
