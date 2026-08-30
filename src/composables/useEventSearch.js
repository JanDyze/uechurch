import { computed } from 'vue'

// Everything an event can be found by. Narrowing used to live in the month
// card's filter and sort panel; the search bar is now the only control, so the
// haystack has to cover every detail someone might type - the type, the month,
// the weekday, whether it is a birthday or part of a weekly series - not just
// the title.
//
// Dates are read out of the 'YYYY-MM-DD' string rather than a parsed Date:
// `new Date('2026-08-01')` is UTC midnight, which is the previous day anywhere
// west of Greenwich, and a search for "friday" would quietly return Thursdays.

const MONTHS_LONG = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

const WEEKDAYS_LONG = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
]

const dateParts = (date) => {
  if (typeof date !== 'string' || date.length < 10) return []

  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return []

  const local = new Date(year, month - 1, day)
  const monthName = MONTHS_LONG[month - 1]
  const weekday = WEEKDAYS_LONG[local.getDay()]

  return [
    date,
    year,
    day,
    monthName,
    // Short forms are indexed alongside the long ones because matching is
    // substring-based: "sep" finds September on its own, but "sept" would not.
    monthName.slice(0, 3),
    weekday,
    weekday.slice(0, 3),
  ]
}

const buildHaystack = (event, todayKey) => {
  const parts = [
    event.title,
    event.type,
    event.location,
    event.description,
    event.time,
    ...dateParts(event.date),
    // The three kinds of event look identical in the list but behave nothing
    // alike, and only search can gather one kind up now that the type filter
    // is gone.
    event.isBirthday ? 'birthday birthdays celebration' : '',
    event.isRecurring ? 'recurring weekly series' : '',
    event.isOverride ? 'changed edited' : '',
    event.memberName,
    // Phrased every way it might be typed, since matching is substring-based.
    event.date < todayKey ? 'past done finished' : 'upcoming coming',
    event.date === todayKey ? 'today' : '',
  ]

  return parts
    .filter((part) => part !== null && part !== undefined && part !== '')
    .join(' ')
    .toLowerCase()
}

export function useEventSearch(events, searchQuery) {
  // Rebuilt when the event list changes, not on every keystroke.
  const searchIndex = computed(() => {
    const now = new Date()
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`

    return events.value.map((event) => ({ event, haystack: buildHaystack(event, todayKey) }))
  })

  // Every word has to match something, so "worship september" keeps narrowing
  // instead of widening the way an OR search would.
  const filteredEvents = computed(() => {
    const terms = searchQuery.value.toLowerCase().split(/\s+/).filter(Boolean)
    if (terms.length === 0) return events.value

    return searchIndex.value
      .filter(({ haystack }) => terms.every((term) => haystack.includes(term)))
      .map(({ event }) => event)
  })

  return { filteredEvents }
}
