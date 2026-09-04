<script setup>
/**
 * Every service there is to run, as a list.
 *
 * This is what Presentation opens on. A church holds one service a week, so a
 * switcher pinned to the presenter was the wrong shape entirely — nobody
 * changes service mid-Sunday, and the column it cost was column the run sheet
 * wanted. Choosing happens once, here, with room to see what is actually
 * prepared; the presenter is then about one service and nothing else.
 *
 * Ordered around the next service rather than by date, because that is the one
 * being prepared. Past services stay reachable underneath — a run sheet from
 * three weeks ago is the quickest way to find the reading that was used.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Play, ChevronRight, ProjectorScreen } from '../icons'
import { subscribeToLineups } from '../api/lineupsService'
import { subscribeToServicePlans } from '../api/servicePlansService'
import { formatServiceDate, formatShortDate, todayIso } from '../utils/lineupUtils'

const router = useRouter()

const lineups = ref([])
const plans = ref({})
const loading = ref(true)
let unsubLineups = null
let unsubPlans = null

onMounted(() => {
  unsubLineups = subscribeToLineups((list) => {
    lineups.value = list
    loading.value = false
  })
  unsubPlans = subscribeToServicePlans((map) => {
    plans.value = map
  })
})

onUnmounted(() => {
  unsubLineups?.()
  unsubPlans?.()
})

const today = todayIso()

/**
 * Every Sunday the worship team has planned, with what the tech team has done
 * to it. A service with no lineup is not here: there would be nothing to run.
 */
const services = computed(() =>
  lineups.value
    .flatMap((month) => month.sundays || [])
    .filter((sunday) => sunday.date)
    .map((sunday) => {
      const plan = plans.value[sunday.date] || null
      return {
        date: sunday.date,
        songCount: (sunday.songs || []).length,
        // The run sheet's own count, not the lineup's: the point of showing it
        // is that it says more than the lineup already does.
        itemCount: plan ? plan.items.length : 0,
        prepared: !!plan,
        isPast: sunday.date < today,
        isToday: sunday.date === today,
      }
    })
)

/** Today first, then the Sundays still to come, soonest first. */
const upcoming = computed(() =>
  services.value.filter((s) => !s.isPast).sort((a, b) => a.date.localeCompare(b.date))
)

/** Most recent first: a reading from last Sunday is worth more than one from May. */
const past = computed(() =>
  services.value.filter((s) => s.isPast).sort((a, b) => b.date.localeCompare(a.date))
)

/** The one being prepared, given its own card at the top. */
const next = computed(() => upcoming.value[0] || null)
const laterUpcoming = computed(() => upcoming.value.slice(1))

const open = (date) => router.push({ name: 'Present', params: { date } })

/** What the row says about the state of a service, in the fewest words. */
const statusOf = (service) => {
  if (!service.prepared) return 'Following the lineup'
  return `${service.itemCount} item${service.itemCount === 1 ? '' : 's'} planned`
}
</script>

<template>
  <div class="mx-auto flex h-full max-w-3xl flex-col">
    <div class="shrink-0 pb-4">
      <h1 class="text-lg font-bold text-gray-900 dark:text-white sm:text-xl">Services</h1>
      <p class="mt-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
        Pick a Sunday to run. Songs come from the worship team's lineup; readings and
        notices are added in the presenter.
      </p>
    </div>

    <div class="custom-scrollbar min-h-0 flex-1 overflow-y-auto pb-4">
      <!-- Waiting on the lineups. Two rows rather than a spinner: it settles
           into the shape that is coming instead of jumping. -->
      <div v-if="loading" class="space-y-2">
        <div v-for="n in 3" :key="n" class="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"></div>
      </div>

      <div
        v-else-if="!services.length"
        class="rounded-xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700"
      >
        <ProjectorScreen class="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" />
        <p class="mt-3 text-sm font-bold text-gray-900 dark:text-white">No services yet</p>
        <p class="mx-auto mt-1 max-w-sm text-xs text-gray-500 dark:text-gray-400">
          A Sunday appears here once the worship team plans a lineup for it.
        </p>
        <button
          @click="router.push('/lineups')"
          class="mt-4 rounded-lg px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/10"
        >
          Go to lineups
        </button>
      </div>

      <template v-else>
        <!-- The next service, given the room it deserves: on a Sunday morning
             this is the only row anyone wants, and it should be reachable
             without reading the list. -->
        <button
          v-if="next"
          @click="open(next.date)"
          class="mb-4 block w-full rounded-2xl border border-primary/30 bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10"
        >
          <p class="text-[10px] font-bold uppercase tracking-widest text-primary">
            {{ next.isToday ? 'Today' : 'Next service' }}
          </p>
          <div class="mt-1 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate text-base font-bold text-gray-900 dark:text-white">
                {{ formatServiceDate(next.date) }}
              </p>
              <p class="mt-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                {{ next.songCount }} {{ next.songCount === 1 ? 'song' : 'songs' }}
                · {{ statusOf(next) }}
              </p>
            </div>
            <span
              class="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white"
            >
              <Play class="h-3.5 w-3.5" />
              Open
            </span>
          </div>
        </button>

        <div v-if="laterUpcoming.length" class="mb-4">
          <p class="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">
            Coming up
          </p>
          <div class="space-y-1.5">
            <button
              v-for="service in laterUpcoming"
              :key="service.date"
              @click="open(service.date)"
              class="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left transition-colors hover:border-primary/40 dark:border-gray-700 dark:bg-gray-800"
            >
              <span
                class="shrink-0 rounded-lg bg-gray-100 px-2 py-1 text-[11px] font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300"
              >
                {{ formatShortDate(service.date) }}
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-bold text-gray-900 dark:text-white">
                  {{ formatServiceDate(service.date) }}
                </span>
                <span class="block text-[11px] font-medium text-gray-400">
                  {{ service.songCount }} {{ service.songCount === 1 ? 'song' : 'songs' }}
                  · {{ statusOf(service) }}
                </span>
              </span>
              <ChevronRight class="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
            </button>
          </div>
        </div>

        <div v-if="past.length">
          <p class="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">
            Past services
          </p>
          <div class="space-y-1.5">
            <button
              v-for="service in past"
              :key="service.date"
              @click="open(service.date)"
              class="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/60"
            >
              <span
                class="shrink-0 rounded-lg bg-gray-100 px-2 py-1 text-[11px] font-bold text-gray-500 dark:bg-gray-700 dark:text-gray-400"
              >
                {{ formatShortDate(service.date) }}
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold text-gray-600 dark:text-gray-300">
                  {{ formatServiceDate(service.date) }}
                </span>
                <span class="block text-[11px] font-medium text-gray-400">
                  {{ statusOf(service) }}
                </span>
              </span>
              <ChevronRight class="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
