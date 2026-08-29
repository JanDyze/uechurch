<script setup>
import { computed, ref, watch } from 'vue'
import { X, Search, Check, UserCheck, Loader2 } from 'lucide-vue-next'
import { useMediaQuery } from '../../composables/useMediaQuery'
import { useFocusTrap } from '../../composables/useFocusTrap'
import { useAuth } from '../../composables/useAuth'
import { getFullName, getAvatarUrl } from '../../utils/memberUtils'
import { suggestMembers } from '../../utils/memberMatch'
import { memberKey } from '../../utils/sgUtils'

const props = defineProps({
  show: { type: Boolean, default: false },
  members: { type: Array, default: () => [] },
  submitting: { type: Boolean, default: false },
})

const emit = defineEmits(['update:show', 'submit'])

const isMobile = useMediaQuery('(max-width: 1023px)')
const { displayName, email } = useAuth()
const dialogRef = ref(null)

const searchQuery = ref('')
const selected = ref(null)

watch(
  () => props.show,
  (show) => {
    if (!show) return
    searchQuery.value = ''
    selected.value = null
  }
)

// Already-linked members belong to someone else and cannot be claimed.
const claimable = computed(() => props.members.filter((member) => !member.uid))

const suggestions = computed(() =>
  searchQuery.value.trim() ? [] : suggestMembers(displayName.value, props.members)
)

const suggestedIds = computed(() => new Set(suggestions.value.map((m) => memberKey(m))))

const results = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const list = [...claimable.value].sort((a, b) =>
    getFullName(a).localeCompare(getFullName(b))
  )
  if (!query) return list.filter((member) => !suggestedIds.value.has(memberKey(member)))
  return list.filter((member) =>
    `${getFullName(member)} ${member.nickname || ''}`.toLowerCase().includes(query)
  )
})

const close = () => emit('update:show', false)

const submit = () => {
  if (!selected.value || props.submitting) return
  emit('submit', selected.value)
}

useFocusTrap(dialogRef, computed(() => props.show), close)
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="show"
        class="fixed inset-0 z-100 flex items-end sm:items-center sm:justify-center"
      >
        <div class="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" @click="close" />

        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="claim-member-title"
          tabindex="-1"
          class="relative z-10 w-full sm:max-w-md max-h-[88dvh] flex flex-col bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border-t sm:border border-gray-200 dark:border-gray-700"
        >
          <!-- Header -->
          <div
            class="shrink-0 flex items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b border-gray-100 dark:border-gray-800"
          >
            <div class="min-w-0">
              <h3
                id="claim-member-title"
                class="text-base font-bold text-gray-900 dark:text-white"
              >
                Which member are you?
              </h3>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
                Signed in as {{ displayName }} ({{ email }})
              </p>
            </div>
            <button
              @click="close"
              class="shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Close"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <!-- Body -->
          <div class="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Pick your own record. An administrator reviews the request before the
              accounts are linked.
            </p>

            <!-- Name-based suggestions -->
            <div v-if="suggestions.length">
              <p
                class="text-[10px] font-black uppercase tracking-widest text-primary mb-2"
              >
                Is this you?
              </p>
              <div class="space-y-1.5">
                <button
                  v-for="member in suggestions"
                  :key="`s-${memberKey(member)}`"
                  type="button"
                  @click="selected = member"
                  :class="[
                    'w-full flex items-center gap-3 p-2.5 rounded-xl border-2 text-left transition-colors',
                    selected && memberKey(selected) === memberKey(member)
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700',
                  ]"
                >
                  <img
                    :src="getAvatarUrl(member)"
                    :alt="getFullName(member)"
                    class="h-10 w-10 rounded-full object-cover bg-gray-100 dark:bg-gray-800"
                  />
                  <span class="flex-1 min-w-0">
                    <span class="block text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {{ getFullName(member) }}
                    </span>
                    <span
                      v-if="member.nickname"
                      class="block text-xs text-gray-500 dark:text-gray-400 truncate"
                    >
                      {{ member.nickname }}
                    </span>
                  </span>
                  <Check
                    v-if="selected && memberKey(selected) === memberKey(member)"
                    class="h-5 w-5 shrink-0 text-primary"
                  />
                </button>
              </div>
            </div>

            <!-- Search the full list -->
            <div>
              <div class="relative mb-2">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  v-model="searchQuery"
                  type="search"
                  placeholder="Search all members"
                  class="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border-2 border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div
                class="rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 max-h-64 overflow-y-auto"
              >
                <p
                  v-if="results.length === 0"
                  class="p-4 text-sm text-center text-gray-500 dark:text-gray-400"
                >
                  No unlinked members match.
                </p>
                <button
                  v-for="member in results"
                  :key="memberKey(member)"
                  type="button"
                  @click="selected = member"
                  class="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                >
                  <img
                    :src="getAvatarUrl(member)"
                    :alt="getFullName(member)"
                    class="h-8 w-8 rounded-full object-cover bg-gray-100 dark:bg-gray-800"
                  />
                  <span class="flex-1 min-w-0 text-sm text-gray-900 dark:text-white truncate">
                    {{ getFullName(member) }}
                  </span>
                  <Check
                    v-if="selected && memberKey(selected) === memberKey(member)"
                    class="h-4 w-4 shrink-0 text-primary"
                  />
                </button>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div
            class="shrink-0 px-4 sm:px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <button
              @click="close"
              class="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              @click="submit"
              :disabled="!selected || submitting"
              class="ml-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Loader2 v-if="submitting" class="h-4 w-4 animate-spin" />
              <UserCheck v-else class="h-4 w-4" />
              Request link
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
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
