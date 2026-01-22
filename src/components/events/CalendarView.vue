<script setup>
import { ChevronLeft, ChevronRight, List } from 'lucide-vue-next'
import * as LucideIcons from 'lucide-vue-next'
import philippineHolidays from '../../data/philippineHolidays.json'

const props = defineProps({
  currentDate: {
    type: Date,
    required: true
  },
  currentMonth: {
    type: String,
    required: true
  },
  calendarDays: {
    type: Array,
    required: true
  },
  selectedDate: {
    type: String,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  },
  events: {
    type: Array,
    default: () => []
  },
  calendarScrollRef: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['navigateMonth', 'dayClick', 'eventClick', 'goToToday', 'calendarWheel', 'showMonthEvents'])

const holidays = philippineHolidays

const formatDateString = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const isToday = (date) => {
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

const getHolidayForDate = (date) => {
  const dateString = formatDateString(date)
  return holidays.find(holiday => holiday.date === dateString)
}

const getEventsForDate = (date) => {
  const dateString = formatDateString(date)
  if (!props.events || !Array.isArray(props.events)) return []
  return props.events.filter((event) => event.date === dateString)
}

const getEventTypeColor = (type) => {
  const colors = {
    worship: 'bg-blue-500 text-white',
    study: 'bg-green-500 text-white',
    youth: 'bg-purple-500 text-white',
    prayer: 'bg-yellow-500 text-white',
    outreach: 'bg-orange-500 text-white',
    music: 'bg-pink-500 text-white',
    birthday: 'bg-red-500 text-white'
  }
  return colors[type] || 'bg-gray-500 text-white'
}

const getIconComponent = (iconName) => {
  return LucideIcons[iconName] || LucideIcons.Calendar
}
</script>

<template>
  <div class="h-full flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
    <!-- Calendar Header -->
    <div class="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <button
          @click="emit('navigateMonth', 'prev')"
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <ChevronLeft class="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </button>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white min-w-[200px] text-center">
          {{ currentMonth }}
        </h2>
        <button
          @click="emit('navigateMonth', 'next')"
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <ChevronRight class="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </button>
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="emit('showMonthEvents')"
          class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
          title="Show all events this month"
        >
          <List class="h-4 w-4" />
          <span class="hidden sm:inline">Month Events</span>
        </button>
        <button
          @click="emit('goToToday')"
          class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Today
        </button>
      </div>
    </div>

    <!-- Calendar Grid -->
    <div :ref="calendarScrollRef" @wheel="emit('calendarWheel', $event)" class="flex-1 overflow-auto p-4">
      <!-- Day Headers -->
      <div class="grid grid-cols-7 gap-1 mb-2">
        <div
          v-for="day in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']"
          :key="day"
          class="p-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400"
        >
          {{ day }}
        </div>
      </div>

      <!-- Calendar Days with transition -->
      <Transition name="calendar-month" mode="out-in">
        <div v-if="loading" :key="`skeleton-${currentMonth}`" class="grid grid-cols-7 gap-1">
          <div
            v-for="i in 42"
            :key="`skeleton-day-${i}`"
            class="min-h-[60px] p-1 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
          >
            <div class="h-4 w-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse mb-1"></div>
            <div class="h-3 w-full bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
          </div>
        </div>
        <div v-else :key="currentMonth" class="grid grid-cols-7 gap-1">
            <div
              v-for="(day, index) in calendarDays"
              :key="index"
              @click="emit('dayClick', day)"
              :class="[
                'min-h-[60px] p-1 rounded-lg transition-all cursor-pointer',
                day.isCurrentMonth
                  ? selectedDate === formatDateString(day.fullDate)
                    ? 'bg-[#01779b]/10 dark:bg-[#01779b]/20 border-2 border-[#01779b] shadow-lg shadow-[#01779b]/20'
                    : isToday(day.fullDate)
                    ? 'bg-[#01779b]/10 dark:bg-[#01779b]/20 border-2 border-[#01779b] shadow-lg shadow-[#01779b]/20'
                    : getHolidayForDate(day.fullDate)
                    ? 'bg-white dark:bg-gray-800 border-2 border-yellow-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                : 'bg-gray-50 dark:bg-gray-900/50 text-gray-400 dark:text-gray-600 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800/50',
              ]"
            >
            <div
              :class="[
                'text-sm font-medium mb-1',
                isToday(day.fullDate) && day.isCurrentMonth
                  ? 'text-[#01779b] dark:text-[#01779b]'
                  : day.isCurrentMonth
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-400 dark:text-gray-600',
              ]"
            >
              {{ day.date }}
            </div>
            <div v-if="getHolidayForDate(day.fullDate)" class="mb-1">
              <div class="px-1.5 py-0.5 text-[10px] bg-yellow-500 text-white rounded truncate" :title="getHolidayForDate(day.fullDate).name">
                {{ getHolidayForDate(day.fullDate).name }}
              </div>
            </div>
            <div v-if="getEventsForDate(day.fullDate).length > 0" class="flex flex-row items-center gap-1" @click.stop>
              <button
                v-if="getEventsForDate(day.fullDate).length > 0"
                :key="getEventsForDate(day.fullDate)[0].id"
                @click.stop="emit('eventClick', getEventsForDate(day.fullDate)[0])"
                :class="[
                  'flex-1 text-left px-1.5 py-0.5 text-[10px] rounded truncate hover:opacity-80 transition-opacity flex items-center gap-1',
                  getEventTypeColor(getEventsForDate(day.fullDate)[0].type),
                ]"
                :title="getEventsForDate(day.fullDate)[0].title"
              >
                <component :is="getIconComponent(getEventsForDate(day.fullDate)[0].icon || 'Calendar')" class="h-3 w-3 flex-shrink-0" />
                <span class="truncate">{{ getEventsForDate(day.fullDate)[0].title }}</span>
              </button>
              <div
                v-if="getEventsForDate(day.fullDate).length > 1"
                class="bg-gray-400 dark:bg-gray-600 text-white text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
              >
                +{{ getEventsForDate(day.fullDate).length - 1 }}
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.calendar-month-enter-active,
.calendar-month-leave-active {
  transition: all 0.25s ease-out;
}

.calendar-month-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.calendar-month-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>

