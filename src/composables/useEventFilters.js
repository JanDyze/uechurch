import { computed, ref } from 'vue'

export function useEventFilters(events, searchQuery) {
  const eventTypeFilter = ref([])
  const upcomingDaysFilter = ref(7)

  // Get filtered events based on search
  const filteredEvents = computed(() => {
    if (!searchQuery.value.trim()) {
      return events.value
    }
    
    const query = searchQuery.value.toLowerCase()
    return events.value.filter((event) => {
      return (
        event.title?.toLowerCase().includes(query) ||
        event.location?.toLowerCase().includes(query) ||
        event.type?.toLowerCase().includes(query) ||
        event.description?.toLowerCase().includes(query)
      )
    })
  })

  // Get all unique event types
  const allEventTypes = computed(() => {
    const typeSet = new Set()
    events.value.forEach((event) => {
      if (event.type) {
        typeSet.add(event.type)
      }
    })
    return Array.from(typeSet).sort()
  })

  // Get upcoming events (filtered by days)
  const upcomingEvents = computed(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + upcomingDaysFilter.value)

    const eventsList = searchQuery.value.trim() ? filteredEvents.value : events.value

    let filtered = eventsList
      .filter((event) => {
        if (!event.date) return false
        const eventDate = new Date(event.date)
        eventDate.setHours(0, 0, 0, 0)
        return eventDate >= today && eventDate <= endDate
      })

    // Apply event type filter - only filter if types are selected
    if (eventTypeFilter.value.length > 0) {
      filtered = filtered.filter((event) => eventTypeFilter.value.includes(event.type))
    }

    return filtered
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 10)
  })

  return {
    eventTypeFilter,
    upcomingDaysFilter,
    filteredEvents,
    allEventTypes,
    upcomingEvents
  }
}



