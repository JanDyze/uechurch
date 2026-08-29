<script setup>
import { computed, ref, watch } from 'vue'
import { X } from '../../icons'
import { useMediaQuery } from '../../composables/useMediaQuery'
import { useFocusTrap } from '../../composables/useFocusTrap'
import { useSgLanguage } from '../../composables/useSgLanguage'
import { getFullName } from '../../utils/memberUtils'
import { memberKey } from '../../utils/sgUtils'
import GroupCoverPicker from './GroupCoverPicker.vue'
import GroupMemberPicker from './GroupMemberPicker.vue'
import LanguageToggle from './LanguageToggle.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  group: { type: Object, default: null },
  members: { type: Array, default: () => [] },
  saving: { type: Boolean, default: false },
})

const emit = defineEmits(['update:show', 'save', 'delete'])

const isMobile = useMediaQuery('(max-width: 1023px)')
const { t, weekdayName } = useSgLanguage()
const dialogRef = ref(null)

const blankForm = () => ({
  name: '',
  description: '',
  coverPhoto: '',
  leaderId: null,
  coLeaderIds: [],
  memberIds: [],
  meetingDay: null,
  meetingTime: '',
  location: '',
  defaultLanguage: 'en',
  active: true,
})

const form = ref(blankForm())

// Re-seed whenever the drawer opens, so editing one group then creating another
// never carries the previous values over.
watch(
  () => [props.show, props.group],
  ([show]) => {
    if (!show) return
    form.value = props.group ? { ...blankForm(), ...props.group } : blankForm()
  },
  { immediate: true }
)

const isEdit = computed(() => Boolean(props.group))
const isValid = computed(() => form.value.name.trim().length > 0)

// The leader is picked from the roster, so a group can never point at someone
// who is not in it.
const rosterOptions = computed(() =>
  props.members
    .filter((member) => form.value.memberIds.some((id) => String(id) === memberKey(member)))
    .sort((a, b) => getFullName(a).localeCompare(getFullName(b)))
)

watch(
  () => form.value.memberIds,
  (ids) => {
    if (form.value.leaderId && !ids.some((id) => String(id) === String(form.value.leaderId))) {
      form.value.leaderId = null
    }
  }
)

const close = () => emit('update:show', false)

const handleSave = () => {
  if (!isValid.value || props.saving) return
  emit('save', {
    ...form.value,
    name: form.value.name.trim(),
    meetingDay: form.value.meetingDay === null || form.value.meetingDay === ''
      ? null
      : Number(form.value.meetingDay),
  })
}

useFocusTrap(dialogRef, computed(() => props.show), close)
</script>

<template>
  <Teleport to="body" :disabled="!isMobile">
    <Transition :name="isMobile ? 'modal-sheet' : 'drawer'">
      <div
        v-if="show"
        :class="[
          isMobile
            ? 'fixed inset-0 z-80 flex flex-col justify-end'
            : 'sg-drawer border-l-4 border-primary bg-white dark:bg-gray-800 w-1/2 h-full flex flex-col shrink-0 shadow-2xl shadow-primary/20',
        ]"
      >
        <div v-if="isMobile" class="absolute inset-0 bg-black/50" @click="close" />

        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sg-group-drawer-title"
          tabindex="-1"
          :class="[
            'flex flex-col min-h-0',
            isMobile
              ? 'relative z-10 w-full max-h-[92dvh] rounded-t-2xl bg-white dark:bg-gray-800 shadow-2xl border-t border-gray-200 dark:border-gray-700'
              : 'flex-1',
          ]"
        >
          <!-- Header -->
          <div
            class="shrink-0 rounded-t-2xl border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 flex items-center justify-between gap-3"
          >
            <h3
              id="sg-group-drawer-title"
              class="text-lg font-semibold text-gray-900 dark:text-white truncate"
            >
              {{ isEdit ? t('edit') : t('newGroup') }}
            </h3>
            <div class="flex items-center gap-2 shrink-0">
              <LanguageToggle />
              <button
                @click="close"
                class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Close"
              >
                <X class="h-5 w-5" />
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-5">
            <GroupCoverPicker v-model="form.coverPhoto" />

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('groupName') }} <span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.name"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('description') }}
              </label>
              <textarea
                v-model="form.description"
                rows="2"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ t('meetingDay') }}
                </label>
                <select
                  v-model="form.meetingDay"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option :value="null">—</option>
                  <option v-for="d in 7" :key="d - 1" :value="d - 1">
                    {{ weekdayName(d - 1) }}
                  </option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {{ t('meetingTime') }}
                </label>
                <input
                  v-model="form.meetingTime"
                  type="time"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('location') }}
              </label>
              <input
                v-model="form.location"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ t('members') }}
              </label>
              <div class="h-72">
                <GroupMemberPicker
                  v-model="form.memberIds"
                  :members="members"
                  :search-label="t('search')"
                  :empty-label="t('noMembers')"
                />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ t('leader') }}
              </label>
              <select
                v-model="form.leaderId"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option :value="null">—</option>
                <option v-for="member in rosterOptions" :key="memberKey(member)" :value="memberKey(member)">
                  {{ getFullName(member) }}
                </option>
              </select>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Pick from the members selected above.
              </p>
            </div>

            <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                v-model="form.active"
                type="checkbox"
                class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              {{ t('active') }}
            </label>
          </div>

          <!-- Sticky actions -->
          <div
            class="shrink-0 border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 flex items-center gap-2 bg-white dark:bg-gray-800 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <button
              v-if="isEdit"
              @click="$emit('delete')"
              class="px-3 py-2.5 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              {{ t('delete') }}
            </button>
            <button
              @click="close"
              class="ml-auto px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {{ t('cancel') }}
            </button>
            <button
              @click="handleSave"
              :disabled="!isValid || saving"
              class="px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ t('save') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sg-drawer {
  transition: max-width 0.3s ease-out, opacity 0.3s ease;
}
.drawer-enter-from.sg-drawer,
.drawer-leave-to.sg-drawer {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
}
.modal-sheet-enter-active,
.modal-sheet-leave-active {
  transition: opacity 0.25s ease;
}
.modal-sheet-enter-active > div:last-child,
.modal-sheet-leave-active > div:last-child {
  transition: transform 0.25s ease;
}
.modal-sheet-enter-from,
.modal-sheet-leave-to {
  opacity: 0;
}
.modal-sheet-enter-from > div:last-child,
.modal-sheet-leave-to > div:last-child {
  transform: translateY(100%);
}
</style>
