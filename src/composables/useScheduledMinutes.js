/**
 * The meetings that are coming but have not been written into yet.
 *
 * A standing gathering marked "keeps minutes" in Settings shows its next
 * occurrence on the Minutes list as a row that does not exist. Nothing is
 * written until somebody opens it — the same bargain the calendar already
 * makes, where a recurring occurrence is computed from the rule every render
 * and only becomes a document when a person changes something about it.
 *
 * That matters more here than on the calendar. A minute pre-created for every
 * meeting on the books would leave an empty record behind for every meeting
 * that was cancelled, postponed, or simply not minuted, and an empty minute is
 * indistinguishable from a meeting nobody bothered to write up.
 *
 * Forthcoming only, and one per gathering. There is deliberately no back-fill:
 * a schedule switched on today has no honest claim on the meetings held before
 * it, and generating rows for them would put permanent "Not started" gaps in
 * the list for meetings that were minuted on paper, or never held.
 */

import { computed } from 'vue'
import { useRecurringSchedules } from './useRecurringSchedules'
import {
  DEFAULT_TIMEZONE,
  addDays,
  occasionsOn,
  occurrenceTitle,
  parseDateString,
  scheduleFallsOn,
  zonedDateString,
} from '../../lib/occurrences'

/**
 * How far ahead to look for the next occurrence. Four months covers a monthly
 * meeting that has just happened — the next one is up to 31 days out, and a
 * quarterly-ish gathering restricted to one week of the month can be further.
 * Bounded because this walks a day at a time.
 */
const HORIZON_DAYS = 120

/**
 * @param {import('vue').Ref<Array>} minutes  the stored minutes, so an
 *   occurrence somebody has already started stops being offered
 */
export function useScheduledMinutes(minutes = { value: [] }) {
  const { schedules } = useRecurringSchedules()

  // Started occurrences, by the pair that identifies one. The minute carries
  // both fields rather than being looked up by its id, so a record that was
  // moved or re-created by hand still counts as "this one is done".
  const started = computed(() => {
    const keys = new Set()
    for (const minute of minutes.value || []) {
      if (minute?.scheduleId && minute?.occurrenceDate) {
        keys.add(`${minute.scheduleId}|${minute.occurrenceDate}`)
      }
    }
    return keys
  })

  const upcoming = computed(() => {
    // Manila, not the device: a phone left on another timezone should not make
    // tonight's meeting disappear or tomorrow's arrive early.
    const today = zonedDateString(new Date(), DEFAULT_TIMEZONE)
    const rows = []

    for (const schedule of schedules.value || []) {
      if (!schedule.enabled || !schedule.keepsMinutes) continue

      // The first occurrence from today that nobody has started. Today counts:
      // the minute is wanted during the meeting, not after it.
      let date = today
      for (let day = 0; day <= HORIZON_DAYS; day += 1) {
        if (scheduleFallsOn(schedule, date)) {
          if (!started.value.has(`${schedule.id}|${date}`)) {
            const parsed = parseDateString(date)
            rows.push({
              // The calendar's own name for this occurrence. Only ever a list
              // key here — what gets stored when it is opened is a minute id.
              id: `recurring-${schedule.id}-${date}`,
              scheduleId: schedule.id,
              occurrenceDate: date,
              title: occurrenceTitle(
                schedule.title || 'Meeting',
                parsed ? occasionsOn(schedule, parsed) : []
              ),
              date,
              startTime: schedule.time || '',
              endTime: '',
              location: schedule.location || '',
              audienceTags: schedule.audienceTags || [],
              attendees: [],
              // What the list keys its ghost rendering off.
              isScheduled: true,
            })
            break
          }
          // Started already — keep walking, so a meeting minuted early still
          // surfaces the one after it.
        }
        date = addDays(date, 1)
      }
    }

    return rows.sort((a, b) => a.date.localeCompare(b.date))
  })

  // Handed back rather than left private: useRecurringSchedules opens a
  // listener per caller, and the page needs the schedule behind a row when
  // somebody taps it. One subscription, two readers.
  return { scheduledMinutes: upcoming, schedules }
}
