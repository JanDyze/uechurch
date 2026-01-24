<script setup>
import { ref, computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
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

const emit = defineEmits(['navigateMonth', 'dayClick', 'eventClick', 'goToToday', 'calendarWheel', 'setDate'])

// Month/Year picker state
const showMonthYearPicker = ref(false)

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const currentYear = computed(() => props.currentDate.getFullYear())
const currentMonthIndex = computed(() => props.currentDate.getMonth())

// Generate year range (10 years before and after current year)
const years = computed(() => {
  const thisYear = new Date().getFullYear()
  const range = []
  for (let y = thisYear - 10; y <= thisYear + 10; y++) {
    range.push(y)
  }
  return range
})

const selectMonth = (monthIndex) => {
  emit('setDate', new Date(currentYear.value, monthIndex, 1))
  showMonthYearPicker.value = false
}

const selectYear = (year) => {
  emit('setDate', new Date(year, currentMonthIndex.value, 1))
}

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
    prayer: 'bg-purple-500 text-white',
    meeting: 'bg-slate-500 text-white',
    fellowship: 'bg-teal-500 text-white',
    outreach: 'bg-orange-500 text-white',
    training: 'bg-green-500 text-white',
    celebration: 'bg-pink-500 text-white',
    special: 'bg-amber-500 text-white',
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
        
        <!-- Clickable Month/Year with Picker -->
        <div class="relative">
          <button
            @click="showMonthYearPicker = !showMonthYearPicker"
            class="px-3 py-1.5 text-lg font-semibold text-gray-900 dark:text-white min-w-[200px] text-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {{ currentMonth }}
          </button>
          
          <!-- Month/Year Picker Dropdown -->
          <div
            v-if="showMonthYearPicker"
            class="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 z-50 min-w-[300px]"
          >
            <!-- Year Selector -->
            <div class="mb-4">
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Year</p>
              <div class="flex items-center gap-2">
                <button
                  @click="selectYear(currentYear - 1)"
                  class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronLeft class="h-4 w-4 text-gray-600 dark:text-gray-300" />
                </button>
                <select
                  :value="currentYear"
                  @change="selectYear(Number($event.target.value))"
                  class="flex-1 px-3 py-2 text-center font-semibold bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] cursor-pointer"
                >
                  <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
                </select>
                <button
                  @click="selectYear(currentYear + 1)"
                  class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronRight class="h-4 w-4 text-gray-600 dark:text-gray-300" />
                </button>
              </div>
            </div>
            
            <!-- Month Grid -->
            <div>
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Month</p>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="(month, index) in months"
                  :key="month"
                  @click="selectMonth(index)"
                  :class="[
                    'px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                    currentMonthIndex === index
                      ? 'bg-[#01779b] dark:bg-[#22b8cf] text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  ]"
                >
                  {{ month.slice(0, 3) }}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <button
          @click="emit('navigateMonth', 'next')"
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <ChevronRight class="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </button>
      </div>
      <button
        @click="emit('goToToday')"
        class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
      >
        Today
      </button>
    </div>
    
    <!-- Click outside to close picker -->
    <div
      v-if="showMonthYearPicker"
      @click="showMonthYearPicker = false"
      class="fixed inset-0 z-40"
    ></div>

    <!-- Calendar Grid -->
    <div :ref="calendarScrollRef" @wheel="emit('calendarWheel', $event)" class="flex-1 flex flex-col p-4 min-h-0">
      <!-- Day Headers -->
      <div class="grid grid-cols-7 gap-1.5 mb-2 flex-shrink-0">
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
        <div v-if="loading" :key="`skeleton-${currentMonth}`" class="calendar-grid flex-1 grid grid-cols-7 grid-rows-6 gap-1.5 min-h-0">
          <div
            v-for="i in 42"
            :key="`skeleton-day-${i}`"
            class="min-h-0 p-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden"
          >
            <div class="h-4 w-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse mb-1"></div>
            <div class="h-3 w-full bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
          </div>
        </div>
        <div v-else :key="currentMonth" class="calendar-grid flex-1 grid grid-cols-7 grid-rows-6 gap-1.5 min-h-0">
            <div
              v-for="(day, index) in calendarDays"
              :key="index"
              @click="emit('dayClick', day)"
              :class="[
                'min-h-0 p-1.5 rounded-lg transition-all cursor-pointer overflow-hidden flex flex-col',
                day.isCurrentMonth
                  ? selectedDate === formatDateString(day.fullDate)
                    ? 'bg-[#01779b]/10 dark:bg-[#01779b]/20 border-2 border-[#01779b] shadow-lg shadow-[#01779b]/20'
                    : isToday(day.fullDate)
                    ? 'bg-amber-500/10 dark:bg-amber-500/20 border-2 border-amber-500 shadow-lg shadow-amber-500/20'
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
                  ? 'text-amber-600 dark:text-amber-400 font-bold'
                  : day.isCurrentMonth
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-400 dark:text-gray-600',
              ]"
            >
              {{ day.date }}
            </div>
            <!-- Show holiday as first item if exists -->
            <div
              v-if="getHolidayForDate(day.fullDate)"
              class="px-1.5 py-1 text-[10px] bg-yellow-500 text-white rounded truncate flex-1 flex items-center"
              :class="{ 'mb-0.5': getEventsForDate(day.fullDate).length > 0 }"
              :title="getHolidayForDate(day.fullDate).name"
            >
              {{ getHolidayForDate(day.fullDate).name }}
            </div>
            <!-- Show events (max 2 total items including holiday) -->
            <div v-if="getEventsForDate(day.fullDate).length > 0" class="flex-1 flex flex-col gap-0.5 min-h-0" @click.stop>
              <!-- First event -->
              <button
                v-if="getEventsForDate(day.fullDate).length > 0"
                :key="getEventsForDate(day.fullDate)[0]?.id"
                @click.stop="emit('eventClick', getEventsForDate(day.fullDate)[0])"
                :class="[
                  'w-full text-left px-1.5 py-1 text-[10px] rounded truncate hover:opacity-80 transition-opacity flex items-center gap-1 flex-1',
                  getEventTypeColor(getEventsForDate(day.fullDate)[0]?.type),
                ]"
                :title="getEventsForDate(day.fullDate)[0]?.title"
              >
                <component :is="getIconComponent(getEventsForDate(day.fullDate)[0]?.icon || 'Calendar')" class="h-3 w-3 shrink-0" />
                <span class="truncate">{{ getEventsForDate(day.fullDate)[0]?.title }}</span>
              </button>
              <!-- Second row: second event + overflow indicator on same line -->
              <div
                v-if="(!getHolidayForDate(day.fullDate) && getEventsForDate(day.fullDate).length > 1) || (getHolidayForDate(day.fullDate) && getEventsForDate(day.fullDate).length > 1)"
                class="flex items-center gap-1 flex-1"
              >
                <button
                  v-if="!getHolidayForDate(day.fullDate) && getEventsForDate(day.fullDate)[1]"
                  :key="getEventsForDate(day.fullDate)[1]?.id"
                  @click.stop="emit('eventClick', getEventsForDate(day.fullDate)[1])"
                  :class="[
                    'flex-1 text-left px-1.5 py-1 text-[10px] rounded truncate hover:opacity-80 transition-opacity flex items-center gap-1 min-w-0',
                    getEventTypeColor(getEventsForDate(day.fullDate)[1]?.type),
                  ]"
                  :title="getEventsForDate(day.fullDate)[1]?.title"
                >
                  <component :is="getIconComponent(getEventsForDate(day.fullDate)[1]?.icon || 'Calendar')" class="h-3 w-3 shrink-0" />
                  <span class="truncate">{{ getEventsForDate(day.fullDate)[1]?.title }}</span>
                </button>
                <!-- +X indicator -->
                <div
                  v-if="(getHolidayForDate(day.fullDate) && getEventsForDate(day.fullDate).length > 1) || (!getHolidayForDate(day.fullDate) && getEventsForDate(day.fullDate).length > 2)"
                  class="bg-gray-500 dark:bg-gray-600 text-white text-[10px] px-1.5 py-1 rounded shrink-0"
                >
                  +{{ getHolidayForDate(day.fullDate) ? getEventsForDate(day.fullDate).length - 1 : getEventsForDate(day.fullDate).length - 2 }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.calendar-grid {
  /* Ensure grid fills available space */
  height: 100%;
}

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

