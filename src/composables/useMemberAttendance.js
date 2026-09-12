import { computed, onMounted, onUnmounted, ref } from 'vue'
import { subscribeToAttendance } from '../api/attendanceService'
import { audienceLabel, audienceTagsOf, excludeTagsOf, membersInAudience } from '../utils/audience'
import { isCalledOff } from '../../lib/eventStatus'

/**
 * One person's turnout, for the gatherings they were actually expected at.
 *
 * This subscribes to the attendance collection directly rather than going
 * through useAttendance(). That composable answers a different question — what
 * still needs recording — and to do it, it pulls events, minutes, the roster
 * and the recurring schedules, which is five Firestore listeners for a page
 * that wants one. Everything needed here is already on the record itself: the
 * audience tags are copied onto it when it is saved, precisely so it can still
 * be read after the event behind it is gone.
 *
 * "Expected" is the same rule the rest of the app counts by (utils/audience.js):
 * a gathering names the member tags it is for, and naming none means everyone.
 * So a choir practice appears on a chorister's profile and on nobody else's,
 * and a Sunday service appears on everybody's.
 *
 * Three states, not two, and the third is the important one. The `attendees`
 * array holds member ids, but only gatherings where somebody actually ticked
 * names in the recorder have one — an event or a recurring service saved as a
 * head count stores `attendees: []` with a `totalAttendees` of ninety. Drawing
 * that as absent would invent a fact: we do not know they were away, we know
 * nobody wrote down who came. It gets its own hollow square and is never
 * counted.
 *
 *   present     their id is on the register
 *   absent      there is a register, and they are not on it
 *   unrecorded  no register was kept for this gathering
 *
 * Cancelled, postponed and deliberately-skipped gatherings are left out
 * entirely: nobody failed to attend a thing that did not happen.
 */
export function useMemberAttendance(member, options = {}) {
  const { limit = 14 } = options

  const records = ref([])
  const loading = ref(true)
  let unsubscribe = null

  onMounted(() => {
    unsubscribe = subscribeToAttendance((rows) => {
      records.value = rows
      loading.value = false
    })
  })

  onUnmounted(() => {
    if (unsubscribe) unsubscribe()
  })

  const sameId = (a, b) => String(a) === String(b)

  const isOnRegister = (record, m) => {
    const ids = Array.isArray(record.attendees) ? record.attendees : []
    return ids.some((id) => sameId(id, m.id) || sameId(id, m.firestoreId))
  }

  const todayIso = () => {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  /** Most recent first, and only gatherings whose date has arrived. */
  const history = computed(() => {
    const m = member?.value
    // The record arrives a tick after the page does. Until it has an id there
    // is nobody to match, and an empty object would match every "everyone"
    // gathering on the books.
    if (!m || (m.id === undefined && m.firestoreId === undefined)) return []

    const today = todayIso()

    return (records.value || [])
      .filter((record) => {
        if (!record?.date || record.date > today) return false
        if (record.skipped || isCalledOff(record)) return false
        return membersInAudience([m], audienceTagsOf(record), excludeTagsOf(record)).length > 0
      })
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, limit)
      .map((record) => {
        const hasRegister = Array.isArray(record.attendees) && record.attendees.length > 0
        return {
          key: record.firestoreId || record.id || `${record.date}-${record.eventTitle}`,
          date: record.date,
          title: record.eventTitle || 'Gathering',
          audience: audienceLabel(audienceTagsOf(record), excludeTagsOf(record)),
          state: !hasRegister ? 'unrecorded' : isOnRegister(record, m) ? 'present' : 'absent',
        }
      })
  })

  /** Only the gatherings a register was kept for can be counted. */
  const counted = computed(() => history.value.filter((h) => h.state !== 'unrecorded'))
  const presentCount = computed(() => counted.value.filter((h) => h.state === 'present').length)
  const unrecordedCount = computed(
    () => history.value.filter((h) => h.state === 'unrecorded').length
  )

  return { history, counted, presentCount, unrecordedCount, loading }
}
