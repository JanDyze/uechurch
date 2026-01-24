import { computed } from 'vue';

// Helper to get which occurrence of a weekday this is in the month (1st, 2nd, 3rd, etc.)
function getWeekdayOccurrence(date) {
  const dayOfMonth = date.getDate();
  return Math.ceil(dayOfMonth / 7);
}

export function useRecurringEvents(firestoreEvents = { value: [] }, members = { value: [] }) {
  // Expected attendees based on member count
  const expectedAttendees = computed(() => members.value?.length || 0);
  // Generate Sunday Service events for current year
  const sundayServiceEvents = computed(() => {
    const currentYear = new Date().getFullYear();
    const events = [];

    // Get all Sundays in the current year
    const startDate = new Date(currentYear, 0, 1); // Jan 1
    const endDate = new Date(currentYear, 11, 31); // Dec 31

    // Find first Sunday
    let current = new Date(startDate);
    while (current.getDay() !== 0) {
      current.setDate(current.getDate() + 1);
    }

    // Generate event for each Sunday
    while (current <= endDate) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      const virtualId = `sunday-service-${dateString}`;

      // Skip if there's an override for this specific virtual event
      const hasOverride = firestoreEvents.value.some(e => e.overrideOf === virtualId);
      if (!hasOverride) {
        events.push({
          id: virtualId,
          firestoreId: null, // Virtual event, not in Firestore
          title: 'Sunday Service',
          type: 'worship',
          date: dateString,
          time: '09:00',
          location: 'UEC Canubing II',
          description: 'Weekly Sunday worship service. Come and join us in praising the Lord!',
          attendees: expectedAttendees.value,
          icon: 'Church',
          // Recurring event fields
          isRecurring: true,
          isVirtual: true,
          recurringType: 'weekly',
        });
      }

      // Move to next Sunday
      current.setDate(current.getDate() + 7);
    }

    return events;
  });

  // Generate Online Prayer Meeting events for 2nd-5th Wednesdays
  const prayerMeetingEvents = computed(() => {
    const currentYear = new Date().getFullYear();
    const events = [];

    // Get all Wednesdays in the current year
    const startDate = new Date(currentYear, 0, 1); // Jan 1
    const endDate = new Date(currentYear, 11, 31); // Dec 31

    // Find first Wednesday (day 3)
    let current = new Date(startDate);
    while (current.getDay() !== 3) {
      current.setDate(current.getDate() + 1);
    }

    // Generate event for each qualifying Wednesday (2nd, 3rd, 4th, 5th)
    while (current <= endDate) {
      const occurrence = getWeekdayOccurrence(current);
      
      // Only 2nd, 3rd, 4th, or 5th Wednesday
      if (occurrence >= 2) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const day = String(current.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;
        const virtualId = `prayer-meeting-${dateString}`;

        // Skip if there's an override for this specific virtual event
        const hasOverride = firestoreEvents.value.some(e => e.overrideOf === virtualId);
        if (!hasOverride) {
          events.push({
            id: virtualId,
            firestoreId: null, // Virtual event, not in Firestore
            title: 'Online Prayer Meeting',
            type: 'prayer',
            date: dateString,
            time: '19:00',
            location: 'Online (Zoom/Google Meet)',
            description: 'Weekly online prayer meeting. Join us to pray together as a community.',
            attendees: expectedAttendees.value,
            icon: 'HandHeart',
            // Recurring event fields
            isRecurring: true,
            isVirtual: true,
            recurringType: 'weekly',
          });
        }
      }

      // Move to next Wednesday
      current.setDate(current.getDate() + 7);
    }

    return events;
  });

  // Get all recurring events combined
  const recurringEvents = computed(() => {
    return [...sundayServiceEvents.value, ...prayerMeetingEvents.value];
  });

  // Get recurring events for a specific month
  const getRecurringEventsForMonth = (year, month) => {
    return recurringEvents.value.filter((event) => {
      const eventDate = new Date(event.date);
      return eventDate.getFullYear() === year && eventDate.getMonth() === month;
    });
  };

  return {
    sundayServiceEvents,
    prayerMeetingEvents,
    recurringEvents,
    getRecurringEventsForMonth,
  };
}
