import { computed } from 'vue';
import { useRecurringSchedules } from './useRecurringSchedules';
import { getVisibleFrom } from '../api/recurringSchedulesService';
import { expectedAttendance } from '../utils/audience';
import { matchesOccurrence, occasionsOn, occurrenceTitle } from '../../lib/occurrences';

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

  // How many to expect at one occurrence: the people carrying the tags the
  // schedule is for, or the whole roster when it names none. Counted here
  // rather than stored, so tagging someone into the choir today changes what
  // next Thursday's practice expects — see utils/audience.js.
  const expectedFor = (schedule) => expectedAttendance(schedule, members.value);

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
          // Which weeks of the month this schedule runs on, "Last" included.
          // The rule lives in lib/occurrences.js so the emailed digest expands
          // the calendar exactly the way this page draws it.
          const wanted = matchesOccurrence(current, schedule.occurrences || []);

          if (wanted) {
            const dateString = toDateString(current);
            const virtualId = virtualIdFor(schedule, dateString);

            // A saved event overriding this date replaces the generated one
            const hasOverride = firestoreEvents.value.some(
              (e) => e.overrideOf === virtualId
            );

            if (!hasOverride) {
              // Communion on the first Sunday is the Sunday service, not a
              // second thing at the same hour: the occasion renames this
              // occurrence and leaves its id — and so its attendance record —
              // exactly where it was.
              const occasions = occasionsOn(schedule, current);

              events.push({
                id: virtualId,
                firestoreId: null, // Generated, not stored
                title: occurrenceTitle(schedule.title, occasions),
                occasions,
                type: schedule.type,
                date: dateString,
                time: schedule.time,
                location: schedule.location,
                description: schedule.description,
                attendees: expectedFor(schedule),
                audienceTags: schedule.audienceTags || [],
                excludeTags: schedule.excludeTags || [],
                icon: schedule.icon,
                isRecurring: true,
                isVirtual: true,
                recurringType: 'weekly',
                scheduleId: schedule.id,
                // Lead time from the schedule: when this occurrence starts
                // being offered for attendance. The calendar ignores it and
                // always shows the occurrence on its date.
                showBefore: schedule.showBefore,
                visibleFrom: getVisibleFrom(dateString, schedule.time, schedule.showBefore),
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
