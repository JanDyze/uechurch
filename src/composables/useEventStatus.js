import {
  addEvent,
  setEventStatus,
  reinstateOccurrence,
} from '../api/eventsService'
import {
  EVENT_STATUS,
  eventStatusFields,
  readEventStatus,
} from '../../lib/eventStatus'

// Calling a gathering off, wherever it is called off from — the Events
// calendar or the Attendance list — and whatever kind of thing it is.
//
// Three kinds arrive here and only one of them is a document:
//
//   a stored event        the fields go on it
//   a weekly occurrence   generated from a Settings schedule, so there is
//                         nothing to write to: an override document is created
//                         in its place, carrying the same details plus the
//                         status. This is the mechanism the calendar already
//                         used for editing a single date.
//   a meeting             minutes are not the calendar's to call off, and are
//                         refused rather than silently half-handled.
//
// Putting it back on has to undo whichever of those happened, which is what
// `statusOnly` on the override is for: an override that exists only to carry
// the cancellation is deleted, and the generated occurrence returns by itself.

/** A generated weekly occurrence has an id but no document behind it. */
const isGenerated = (event) => Boolean(event?.isVirtual || (!event?.firestoreId && event?.id))

export function useEventStatus() {
  /**
   * @param event   the row or calendar entry being called off
   * @param status  'cancelled' | 'postponed' | 'scheduled' (scheduled = back on)
   * @param note    why, in the church's own words. Optional, and shown wherever
   *                the gathering is.
   * @param movedTo where a postponed gathering went, as YYYY-MM-DD. Optional —
   *                "postponed, date to follow" is a real answer.
   */
  const setStatus = async (event, { status, note = '', movedTo = '' } = {}) => {
    if (!event) return
    if (event.isBirthday || event.rowType === 'minute') {
      throw new Error('Only events and services can be called off')
    }

    const next = status || EVENT_STATUS.SCHEDULED
    const backOn = next === EVENT_STATUS.SCHEDULED
    const firestoreId = event.firestoreId || null

    // A generated occurrence being called off for the first time: stand an
    // override in for it, carrying enough of the occurrence to render on its
    // own once the schedule stops generating it.
    if (!firestoreId && isGenerated(event)) {
      if (backOn) return // nothing was ever written, so there is nothing to undo
      await addEvent({
        title: event.title || event.eventTitle || 'Untitled',
        type: event.type || event.eventType || 'worship',
        date: event.date || '',
        time: event.time || '',
        location: event.location || '',
        description: event.description || '',
        attendees: 0,
        icon: event.icon || 'Calendar',
        audienceTags: event.audienceTags || [],
        excludeTags: event.excludeTags || [],
        overrideOf: event.id,
        isOverride: true,
        // Nothing but the status, so putting it back on is a delete.
        statusOnly: true,
        ...eventStatusFields({ status: next, note, movedTo }),
      })
      return
    }

    if (!firestoreId) throw new Error('Nothing to write this status to')

    // Back on, and the document only ever existed to say it was off: remove it
    // and let the schedule generate the occurrence again.
    if (backOn && event.statusOnly && event.overrideOf) {
      await reinstateOccurrence(firestoreId, event)
      return
    }

    await setEventStatus(firestoreId, event, { status: next, note, movedTo })
  }

  return { setStatus, readEventStatus }
}
