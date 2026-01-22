import { ref, computed } from 'vue'
import philippineHolidays from '../data/philippineHolidays.json'

export function useCalendar() {
  const currentDate = ref(new Date())
  const selectedDate = ref(null)
  const calendarScrollRef = ref(null)
  
  let lastNavigationTime = 0
  const wheelDebounce = 300
  let isNavigating = false
  let wheelTimeout = null

  const holidays = philippineHolidays

  // Format date for comparison (using local date to avoid timezone issues)
  const formatDateString = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Check if date is today
  const isToday = (date) => {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  // Get holiday for a specific date
  const getHolidayForDate = (date) => {
    const dateString = formatDateString(date)
    return holidays.find(holiday => holiday.date === dateString)
  }

  // Get current month and year
  const currentMonth = computed(() => {
    return currentDate.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  })

  // Get days in month
  const daysInMonth = computed(() => {
    const year = currentDate.value.getFullYear()
    const month = currentDate.value.getMonth()
    return new Date(year, month + 1, 0).getDate()
  })

  // Get first day of month (0 = Sunday, 1 = Monday, etc.)
  const firstDayOfMonth = computed(() => {
    const year = currentDate.value.getFullYear()
    const month = currentDate.value.getMonth()
    return new Date(year, month, 1).getDay()
  })

  // Generate calendar days
  const calendarDays = computed(() => {
    const days = []
    const daysInPrevMonth = new Date(
      currentDate.value.getFullYear(),
      currentDate.value.getMonth(),
      0
    ).getDate()

    // Add previous month's trailing days
    for (let i = firstDayOfMonth.value - 1; i >= 0; i--) {
      days.push({
        date: daysInPrevMonth - i,
        isCurrentMonth: false,
        fullDate: new Date(
          currentDate.value.getFullYear(),
          currentDate.value.getMonth() - 1,
          daysInPrevMonth - i
        )
      })
    }

    // Add current month's days
    for (let i = 1; i <= daysInMonth.value; i++) {
      days.push({
        date: i,
        isCurrentMonth: true,
        fullDate: new Date(
          currentDate.value.getFullYear(),
          currentDate.value.getMonth(),
          i
        )
      })
    }

    // Add next month's leading days to fill the grid
    const totalCells = 42 // 6 rows * 7 days
    const remainingDays = totalCells - days.length
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: i,
        isCurrentMonth: false,
        fullDate: new Date(
          currentDate.value.getFullYear(),
          currentDate.value.getMonth() + 1,
          i
        )
      })
    }

    return days
  })

  // Calendar navigation
  const navigateMonth = (direction) => {
    const currentMonthYear = `${currentDate.value.getFullYear()}-${currentDate.value.getMonth()}`
    const newDate = new Date(currentDate.value)
    
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1)
    } else if (direction === 'next') {
      newDate.setMonth(newDate.getMonth() + 1)
    } else {
      return // Invalid direction
    }
    
    const newMonthYear = `${newDate.getFullYear()}-${newDate.getMonth()}`
    
    // Only update if we're actually changing to a different month
    if (currentMonthYear !== newMonthYear) {
      currentDate.value = newDate
    }
  }

  // Handle wheel scroll for month navigation
  const handleCalendarWheel = (e) => {
    // CRITICAL: Check lock flag FIRST - absolute first thing
    if (isNavigating) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    
    e.preventDefault()
    e.stopPropagation()
    
    const now = Date.now()
    
    // Check debounce period
    if (now - lastNavigationTime < wheelDebounce) {
      return
    }
    
    // Determine scroll direction - only process if there's actual scroll
    if (Math.abs(e.deltaY) < 1) {
      return
    }
    
    const scrollDirection = e.deltaY > 0 ? 'next' : 'prev'
    
    // SET LOCK FLAG SYNCHRONOUSLY AND IMMEDIATELY - THIS IS CRITICAL
    isNavigating = true
    lastNavigationTime = now
    
    // Clear any existing timeout
    if (wheelTimeout) {
      clearTimeout(wheelTimeout)
    }
    
    // Navigate synchronously
    navigateMonth(scrollDirection)
    
    // Reset lock after debounce period
    wheelTimeout = setTimeout(() => {
      isNavigating = false
      wheelTimeout = null
    }, wheelDebounce)
  }

  const goToToday = () => {
    currentDate.value = new Date()
  }

  return {
    currentDate,
    selectedDate,
    calendarScrollRef,
    currentMonth,
    calendarDays,
    formatDateString,
    isToday,
    getHolidayForDate,
    navigateMonth,
    handleCalendarWheel,
    goToToday
  }
}



