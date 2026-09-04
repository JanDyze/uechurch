<script setup>
import { ref, computed } from 'vue'
import { X, Sparkles, ChevronDown } from '../../icons'
import { useFocusTrap } from '../../composables/useFocusTrap'
import { useVersionCheck } from '../../composables/useVersionCheck'

const { isOpen, releasesToShow, hasUnseenReleases, currentVersion, versionHistory, close } =
  useVersionCheck()

// The whole history is a long read, so it is a second view rather than more of
// the first one, and only one release is open in it at a time.
const showAll = ref(false)
const expandedVersion = ref(null)

const openAll = () => {
  showAll.value = true
  expandedVersion.value = versionHistory[0]?.version ?? null
}

const toggle = (version) => {
  expandedVersion.value = expandedVersion.value === version ? null : version
}

const dismiss = () => {
  showAll.value = false
  expandedVersion.value = null
  close()
}

const dialogRef = ref(null)
useFocusTrap(dialogRef, isOpen, dismiss)

// Reached two ways, and it should not tell someone who came looking that
// something has changed when nothing has.
const subtitle = computed(() => {
  if (showAll.value) return `${versionHistory.length} releases so far`
  if (!hasUnseenReleases.value) return `You're on the latest version, v${currentVersion}`
  if (releasesToShow.value.length > 1)
    return `${releasesToShow.value.length} updates since you were last here`
  return 'The app has been updated'
})

const formatDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
</script>

<template>
  <!-- z-120 matches ConfirmationModal: this opens over whatever drawer or
       sheet the app happened to restore on launch. -->
  <Teleport to="body">
    <Transition name="whats-new">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-120 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
        @click.self="dismiss"
      >
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="whats-new-title"
          tabindex="-1"
          class="flex flex-col w-full sm:max-w-lg max-h-[85dvh] sm:max-h-[80dvh] bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-xl"
          @click.stop
        >
          <!-- Header -->
          <div
            class="shrink-0 flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 pb-4 border-b border-gray-200 dark:border-gray-700"
          >
            <div class="flex items-start gap-3 min-w-0">
              <span
                class="shrink-0 grid place-items-center h-10 w-10 rounded-full text-white"
                :style="{ background: 'var(--color-primary)' }"
              >
                <Sparkles class="h-5 w-5" />
              </span>
              <div class="min-w-0">
                <h2
                  id="whats-new-title"
                  class="text-lg font-semibold text-gray-900 dark:text-white"
                >
                  {{ showAll ? 'All releases' : "What's new" }}
                </h2>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ subtitle }}
                </p>
              </div>
            </div>
            <button
              @click="dismiss"
              aria-label="Close"
              class="shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <!-- Releases -->
          <div class="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
            <div v-if="!showAll" class="space-y-6">
            <section v-for="release in releasesToShow" :key="release.version">
              <div class="flex items-baseline gap-2 flex-wrap">
                <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                  {{ release.title }}
                </h3>
                <span
                  class="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                >
                  v{{ release.version }}
                </span>
              </div>
              <p class="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                {{ formatDate(release.date) }}
              </p>
              <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {{ release.summary }}
              </p>
              <ul class="mt-3 space-y-2">
                <li
                  v-for="(item, i) in release.highlights"
                  :key="i"
                  class="flex gap-2.5 text-sm text-gray-700 dark:text-gray-300"
                >
                  <span
                    class="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full"
                    :style="{ background: 'var(--color-primary)' }"
                  />
                  <span>{{ item }}</span>
                </li>
              </ul>
            </section>

            <!-- Only reachable on a build with no entry of its own — a local
                 dev run, where the version is not substituted in. -->
            <p
              v-if="!releasesToShow.length"
              class="text-sm text-gray-500 dark:text-gray-400"
            >
              No release notes for this build.
            </p>
            </div>

            <!-- Every release, titles only until one is opened. -->
            <div v-else class="divide-y divide-gray-100 dark:divide-gray-700">
              <div v-for="release in versionHistory" :key="release.version">
                <button
                  type="button"
                  @click="toggle(release.version)"
                  :aria-expanded="expandedVersion === release.version"
                  class="w-full flex items-center gap-3 py-3 text-left"
                >
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-semibold text-gray-900 dark:text-white">
                      {{ release.title }}
                    </span>
                    <span class="block text-xs text-gray-400 dark:text-gray-500">
                      v{{ release.version }} &middot; {{ formatDate(release.date) }}
                    </span>
                  </span>
                  <ChevronDown
                    class="h-4 w-4 shrink-0 text-gray-400 transition-transform"
                    :class="expandedVersion === release.version ? 'rotate-180' : ''"
                  />
                </button>
                <div v-if="expandedVersion === release.version" class="pb-4">
                  <p class="text-sm text-gray-600 dark:text-gray-300">{{ release.summary }}</p>
                  <ul class="mt-3 space-y-2">
                    <li
                      v-for="(item, i) in release.highlights"
                      :key="i"
                      class="flex gap-2.5 text-sm text-gray-700 dark:text-gray-300"
                    >
                      <span
                        class="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full"
                        :style="{ background: 'var(--color-primary)' }"
                      />
                      <span>{{ item }}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer. pb accounts for the phone's home indicator. -->
          <div
            class="shrink-0 px-5 sm:px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4 border-t border-gray-200 dark:border-gray-700"
          >
            <button
              @click="dismiss"
              class="w-full px-4 py-2.5 rounded-lg text-white font-medium transition-opacity hover:opacity-90"
              :style="{ background: 'var(--color-primary)' }"
            >
              {{ showAll ? 'Done' : 'Got it' }}
            </button>
            <button
              type="button"
              @click="showAll ? (showAll = false) : openAll()"
              class="mt-2 w-full py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              {{ showAll ? 'Back' : 'See all releases' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.whats-new-enter-active,
.whats-new-leave-active {
  transition: opacity 0.25s ease;
}

.whats-new-enter-from,
.whats-new-leave-to {
  opacity: 0;
}

/* On a phone the panel is a sheet and rises from the bottom; on a desktop it
   is a dialog and simply fades with the backdrop. */
@media (max-width: 639px) {
  .whats-new-enter-active > div,
  .whats-new-leave-active > div {
    transition: transform 0.25s ease;
  }

  .whats-new-enter-from > div,
  .whats-new-leave-to > div {
    transform: translateY(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .whats-new-enter-active,
  .whats-new-leave-active,
  .whats-new-enter-active > div,
  .whats-new-leave-active > div {
    transition: none;
  }
}
</style>
