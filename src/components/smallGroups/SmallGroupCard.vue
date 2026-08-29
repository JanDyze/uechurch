<script setup>
import { computed } from 'vue'
import { UsersRound, MapPin, CalendarDays, NotebookPen } from '../../icons'
import { useSgLanguage } from '../../composables/useSgLanguage'
import { getFullName, getAvatarUrl } from '../../utils/memberUtils'
import { findMemberById, formatTimeRange } from '../../utils/sgUtils'

const props = defineProps({
  group: { type: Object, required: true },
  members: { type: Array, default: () => [] },
  sessionCount: { type: Number, default: null },
})

defineEmits(['click'])

const { t, weekdayName } = useSgLanguage()

const leader = computed(() => findMemberById(props.members, props.group.leaderId))

const schedule = computed(() => {
  const day = props.group.meetingDay === null ? '' : weekdayName(props.group.meetingDay)
  const time = formatTimeRange(props.group.meetingTime, '')
  return [day, time].filter(Boolean).join(' • ')
})
</script>

<template>
  <button
    type="button"
    @click="$emit('click')"
    class="group w-full text-left rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary/50 hover:shadow-lg hover:-translate-y-0.5 transition-all"
  >
    <!-- Cover. Falls back to a tinted panel so every card keeps the same
         silhouette whether or not a photo was uploaded. -->
    <div
      class="relative aspect-[16/9] bg-gradient-to-br from-primary/25 via-primary/10 to-primary/5 dark:from-primary/30 dark:via-primary/15 dark:to-gray-800"
    >
      <img
        v-if="group.coverPhoto"
        :src="group.coverPhoto"
        alt=""
        class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />
      <UsersRound
        v-else
        class="absolute inset-0 m-auto h-14 w-14 text-primary/40"
      />

      <div class="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

      <div class="absolute inset-x-0 bottom-0 p-3 sm:p-4 flex items-end gap-2">
        <h3 class="flex-1 min-w-0 text-lg sm:text-xl font-bold text-white truncate">
          {{ group.name }}
        </h3>
        <span
          v-if="!group.active"
          class="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-white/85 text-gray-700"
        >
          {{ t('inactive') }}
        </span>
      </div>
    </div>

    <div class="p-3 sm:p-4 space-y-3">
      <div v-if="leader" class="flex items-center gap-2 min-w-0">
        <img
          :src="getAvatarUrl(leader)"
          alt=""
          class="h-8 w-8 shrink-0 rounded-full object-cover bg-gray-100 dark:bg-gray-700"
        />
        <div class="min-w-0">
          <p class="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {{ t('leader') }}
          </p>
          <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
            {{ getFullName(leader) }}
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-1.5">
        <span
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300"
        >
          <UsersRound class="h-3.5 w-3.5" />
          {{ group.memberIds.length }} {{ t('members') }}
        </span>
        <span
          v-if="sessionCount !== null"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300"
        >
          <NotebookPen class="h-3.5 w-3.5" />
          {{ sessionCount }} {{ t('sessions') }}
        </span>
        <span
          v-if="schedule"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300"
        >
          <CalendarDays class="h-3.5 w-3.5" />
          {{ schedule }}
        </span>
        <span
          v-if="group.location"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 min-w-0 max-w-full"
        >
          <MapPin class="h-3.5 w-3.5 shrink-0" />
          <span class="truncate">{{ group.location }}</span>
        </span>
      </div>

      <p
        v-if="group.description"
        class="text-sm text-gray-500 dark:text-gray-400 line-clamp-2"
      >
        {{ group.description }}
      </p>
    </div>
  </button>
</template>
