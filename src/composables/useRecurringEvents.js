import { computed } from 'vue';
import { useRecurringSchedules } from './useRecurringSchedules';

// Which occurrence of its weekday this date is within the month (1st, 2nd, ...)
function getWeekdayOccurrence(date) {
  const dayOfMonth = date.getDate();
  return Math.ceil(dayOfMonth / 7);
}

function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Stable id for a generated occurrence, so edits to a single date can override
// it without touching the rest of the series.
function virtualIdFor(schedule, dateString) {
  return `recurring-${schedule.id}-${dateString}`;
}

/**
 * Expands the recurring schedules configured in Settings into calendar events
 * for the current year. Nothing is hardcoded here - if there are no schedules,
 * no recurring events are generated.
 */
export function useRecurringEvents(firestoreEvents = { value: [] }, members = { value: [] }) {
  const { schedules, loading } = useRecurringSchedules();

  // Expected attendees defaults to the size of the congregation
  const expectedAttendees = computed(() => members.value?.length || 0);

  const recurringEvents = computed(() => {
    const currentYear = new Date().getFullYear();
    const endDate = new Date(currentYear, 11, 31);
    const events = [];

    schedules.value
      .filter((schedule) => schedule.enabled)
      .forEach((schedule) => {
        // Walk to the first matching weekday of the year
        const current = new Date(currentYear, 0, 1);
        while (current.getDay() !== schedule.weekday) {
          current.setDate(current.getDate() + 1);
        }

        while (current <= endDate) {
          const occurrence = getWeekdayOccurrence(current);
          const wanted =
            !schedule.occurrences?.length || schedule.occurrences.includes(occurrence);

          if (wanted) {
            const dateString = toDateString(current);
            const virtualId = virtualIdFor(schedule, dateString);

            // A saved event overriding this date replaces the generated one
            const hasOverride = firestoreEvents.value.some(
              (e) => e.overrideOf === virtualId
            );

            if (!hasOverride) {
              events.push({
                id: virtualId,
                firestoreId: null, // Generated, not stored
                title: schedule.title,
                type: schedule.type,
                date: dateString,
                time: schedule.time,
                location: schedule.location,
                description: schedule.description,
                attendees: expectedAttendees.value,
                icon: schedule.icon,
                isRecurring: true,
                isVirtual: true,
                recurringType: 'weekly',
                scheduleId: schedule.id,
              });
            }
          }

          current.setDate(current.getDate() + 7);
        }
      });

    return events;
  });

  const getRecurringEventsForMonth = (year, month) => {
    return recurringEvents.value.filter((event) => {
      const eventDate = new Date(event.date);
      return eventDate.getFullYear() === year && eventDate.getMonth() === month;
    });
  };

  return {
    schedules,
    loading,
    recurringEvents,
    getRecurringEventsForMonth,
  };
}
