<script setup>
import { computed } from 'vue'
import { BookOpen, Users, ChevronRight } from 'lucide-vue-next'
import { useSgLanguage } from '../../composables/useSgLanguage'
import { formatSessionDate, formatTimeRange, sessionTotals } from '../../utils/sgUtils'

const props = defineProps({
  session: { type: Object, required: true },
})

defineEmits(['click'])

const { lang, t } = useSgLanguage()

const totals = computed(() => sessionTotals(props.session))
const dateLabel = computed(() => formatSessionDate(props.session.date, lang.value))
const timeLabel = computed(() =>
  formatTimeRange(props.session.startTime, props.session.endTime)
)
</script>

<template>
  <button
    type="button"
    @click="$emit('click')"
    class="w-full text-left px-4 py-3.5 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
  >
    <span
      class="h-10 w-10 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center"
    >
      <BookOpen class="h-4.5 w-4.5" />
    </span>

    <div class="flex-1 min-w-0">
      <h4 class="text-sm font-semibold text-gray-900 dark:text-white truncate">
        {{ session.lesson.title || t('session') }}
      </h4>
      <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
        {{ dateLabel }}<template v-if="timeLabel"> • {{ timeLabel }}</template>
      </p>
      <p
        v-if="session.lesson.scripture"
        class="mt-0.5 text-xs italic text-gray-400 dark:text-gray-500 truncate"
      >
        {{ session.lesson.scripture }}
      </p>
    </div>

    <span
      class="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1"
      :title="t('totalAttendance')"
    >
      <Users class="h-3.5 w-3.5" />
      {{ totals.total }}
    </span>
    <ChevronRight class="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600 mt-1.5" />
  </button>
</template>
