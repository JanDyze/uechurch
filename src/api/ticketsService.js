import { db } from './firebase'
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore'
import { inBatches } from './batchWrite'
import { isTicketKind, isTicketStatus } from '../utils/ticketUtils'

// These ride in the `tasks` collection rather than one of their own, marked by
// `scope`. A new collection needs a matching Firestore security rule written by
// hand in the console before a single write lands, and that is a trip nobody
// should have to make to file a bug against their own app. `tasks` is already
// permitted, so this works the moment it deploys.
//
// The cost: a dev ticket is stored beside the church's work and is readable by
// anyone with tasks.view. Nothing here is sensitive — "fix the lineup drawer"
// is not a secret — but neither list shows the other's rows, filtered on this
// marker at both subscriptions.
const TICKETS_COLLECTION = 'tasks'
export const DEV_SCOPE = 'dev'

const normalizeTicket = (snapshot) => {
  const data = snapshot.data()
  return {
    id: snapshot.id,
    firestoreId: snapshot.id,
    title: data.title || '',
    details: data.details || '',
    kind: isTicketKind(data.kind) ? data.kind : 'feature',
    order: typeof data.order === 'number' ? data.order : null,
    assigneeUid: data.assigneeUid || '',
    assigneeName: data.assigneeName || '',
    // `done` is what the first version of this wrote; anything stored then
    // still reads correctly without a migration.
    status: isTicketStatus(data.status) ? data.status : data.done ? 'done' : 'open',
    doneAt: data.doneAt?.toDate?.() || null,
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date(),
  }
}

/** Live list, newest written first. The page regroups it by kind. */
export const subscribeToTickets = (callback) => {
  const q = query(collection(db, TICKETS_COLLECTION), orderBy('createdAt', 'desc'))

  return onSnapshot(
    q,
    (snapshot) =>
      callback(
        snapshot.docs.filter((d) => d.data().scope === DEV_SCOPE).map(normalizeTicket)
      ),
    (error) => {
      console.error('Error subscribing to tickets:', error)
      callback([])
    }
  )
}

// No push notification, unlike a task. Nobody is being asked to do anything —
// this list is written and read by the same person.
export const addTicket = async ({ title, details = '', kind = 'feature' }) => {
  try {
    const docRef = await addDoc(collection(db, TICKETS_COLLECTION), {
      title,
      details,
      kind: isTicketKind(kind) ? kind : 'feature',
      // Negative and falling, so something just thought of lands at the top of
      // an ascending sort without having to read the list first. A drag
      // rewrites these to 0, 1000, 2000 … and new arrivals still sort above.
      order: -Date.now(),
      assigneeUid: '',
      assigneeName: '',
      scope: DEV_SCOPE,
      status: 'open',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  } catch (error) {
    console.error('Error adding ticket:', error)
    throw error
  }
}

const refFor = (ticket) => doc(db, TICKETS_COLLECTION, ticket.firestoreId || ticket.id)

export const updateTicket = async (ticket, updates) => {
  try {
    await updateDoc(refFor(ticket), { ...updates, updatedAt: Timestamp.now() })
  } catch (error) {
    console.error('Error updating ticket:', error)
    throw error
  }
}

/**
 * Every move a ticket can make, in one place, so the view asks for a state
 * rather than assembling the fields that state implies.
 *
 * Starting takes the ticket; going back to `open` is the drop, and gives up
 * the claim. Pausing deliberately does neither — it stays yours.
 */
export const setTicketStatus = async (ticket, status, { uid = '', name = '' } = {}) => {
  const updates = { status, updatedAt: Timestamp.now() }

  if (status === 'doing' && uid) {
    updates.assigneeUid = uid
    updates.assigneeName = name
  }
  if (status === 'open') {
    updates.assigneeUid = ''
    updates.assigneeName = ''
  }
  updates.doneAt = status === 'done' ? Timestamp.now() : null

  try {
    await updateDoc(refFor(ticket), updates)
  } catch (error) {
    console.error('Error updating ticket:', error)
    throw error
  }
}

export const deleteTicket = async (ticket) => {
  try {
    await deleteDoc(refFor(ticket))
  } catch (error) {
    console.error('Error deleting ticket:', error)
    throw error
  }
}

/**
 * Commit a whole list's new positions at once. Rewriting every row rather than
 * patching the two that moved keeps the numbers evenly spaced, so the next
 * drag never has to find room between two neighbours.
 */
export const reorderTickets = async (ordered = []) => {
  try {
    await inBatches(
      ordered.map((ticket, index) => ({ ticket, index })),
      (batch, { ticket, index }) =>
        batch.update(refFor(ticket), { order: index * 1000, updatedAt: Timestamp.now() })
    )
  } catch (error) {
    console.error('Error reordering tickets:', error)
    throw error
  }
}
