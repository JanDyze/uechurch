// Firestore, as the rest of the app is allowed to use it: identical to
// 'firebase/firestore' except that nothing can be written without saying who
// wrote it.
//
// Every write the app makes — adding a person, ticking a task, calling off a
// Sunday — goes through one of five functions: addDoc, setDoc, updateDoc,
// deleteDoc and writeBatch. Each is replaced here by a version that commits the
// change and an entry in `auditLog` in the same batch. A batch lands whole or
// not at all, so there is no change without its entry and no entry for a change
// that never happened; a log written after the fact, on a second round trip,
// is a log with holes wherever a phone lost signal between the two.
//
// "Strictly" is why this is a module rather than a habit. vite.config.js
// refuses to build if any file other than this one imports 'firebase/firestore'
// directly, so a new service cannot quietly write around the log.
//
// What an entry holds: who (uid, name, email as the account has them), when
// (the server's clock, not the phone's), what (collection, document, the
// fields written, and a short preview of each value), and from which page.
// Not the value before — that would cost a read on every write, and the
// quota is small enough that the public page has gone blank over it before.

import {
  addDoc as fsAddDoc,
  collection,
  deleteDoc as fsDeleteDoc,
  doc,
  serverTimestamp,
  setDoc as fsSetDoc,
  updateDoc as fsUpdateDoc,
  writeBatch as fsWriteBatch,
} from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import {
  AUDIT_COLLECTION,
  MAX_FIELDS,
  describeData,
  labelOf,
  topCollection,
} from '../../lib/auditEntry.js'

export * from 'firebase/firestore'
export { AUDIT_COLLECTION }

/**
 * Bookkeeping the app does on its own, many times an hour, that no person
 * decided: the heartbeat that says who is online, the "last seen" stamp, a
 * phone's push token, and the per-account preferences like a remembered tab.
 * Logging these would bury every real change under thousands of entries and
 * double the writes the quota is already tight on. The log itself is here so
 * it does not log its own entries.
 */
const NOT_AUDITED = new Set([AUDIT_COLLECTION, 'presence', 'userAccounts', 'fcmTokens', 'userPrefs'])

const isAudited = (ref) => !NOT_AUDITED.has(topCollection(ref?.path))

/** updateDoc's other signature: (ref, 'field', value, 'field', value, …). */
const pairsToObject = (args) => {
  const out = {}
  for (let i = 0; i + 1 < args.length; i += 2) {
    const key = typeof args[i] === 'string' ? args[i] : String(args[i]?._internalPath || args[i])
    out[key] = args[i + 1]
  }
  return out
}

/* --------------------------------------------------------------- entries */

const actor = () => {
  const user = getAuth().currentUser
  return {
    actorUid: user?.uid || '',
    actorName: user?.displayName || '',
    actorEmail: user?.email || '',
  }
}

const page = () => (typeof window !== 'undefined' ? window.location.pathname : '')

const entryFor = (action, ref, data) => ({
  at: serverTimestamp(),
  ...actor(),
  action,
  collection: topCollection(ref.path),
  path: ref.path,
  docId: ref.id,
  label: labelOf(data),
  ...describeData(data),
  page: page(),
  source: 'app',
})

const auditRef = (db) => doc(collection(db, AUDIT_COLLECTION))

/* ---------------------------------------------------------------- writes */

export const addDoc = async (collectionRef, data) => {
  if (!isAudited(collectionRef)) return fsAddDoc(collectionRef, data)
  const ref = doc(collectionRef)
  const batch = fsWriteBatch(collectionRef.firestore)
  batch.set(ref, data)
  batch.set(auditRef(collectionRef.firestore), entryFor('create', ref, data))
  await batch.commit()
  return ref
}

export const setDoc = async (ref, data, options) => {
  if (!isAudited(ref)) return options ? fsSetDoc(ref, data, options) : fsSetDoc(ref, data)
  const batch = fsWriteBatch(ref.firestore)
  if (options) batch.set(ref, data, options)
  else batch.set(ref, data)
  batch.set(auditRef(ref.firestore), entryFor(options?.merge ? 'update' : 'set', ref, data))
  await batch.commit()
}

export const updateDoc = async (ref, ...args) => {
  if (!isAudited(ref)) return fsUpdateDoc(ref, ...args)
  const data = args.length === 1 ? args[0] : pairsToObject(args)
  const batch = fsWriteBatch(ref.firestore)
  batch.update(ref, ...args)
  batch.set(auditRef(ref.firestore), entryFor('update', ref, data))
  await batch.commit()
}

export const deleteDoc = async (ref) => {
  if (!isAudited(ref)) return fsDeleteDoc(ref)
  const batch = fsWriteBatch(ref.firestore)
  batch.delete(ref)
  batch.set(auditRef(ref.firestore), entryFor('delete', ref, null))
  await batch.commit()
}

/**
 * A batch that writes one entry for everything in it, at commit.
 *
 * One entry rather than one per operation: tagging a hundred people is one
 * thing somebody did, and Firestore's 500-write ceiling per batch leaves room
 * for exactly one more — which is why batchWrite.js chunks at 499.
 */
export const writeBatch = (db) => {
  const batch = fsWriteBatch(db)
  const ops = []

  const note = (action, ref, data) => {
    if (isAudited(ref)) ops.push({ action, ref, data })
  }

  return {
    set(ref, data, options) {
      note(options?.merge ? 'update' : 'set', ref, data)
      if (options) batch.set(ref, data, options)
      else batch.set(ref, data)
      return this
    },
    update(ref, ...args) {
      note('update', ref, args.length === 1 ? args[0] : pairsToObject(args))
      batch.update(ref, ...args)
      return this
    },
    delete(ref) {
      note('delete', ref, null)
      batch.delete(ref)
      return this
    },
    async commit() {
      if (ops.length === 1) {
        const [{ action, ref, data }] = ops
        batch.set(auditRef(db), entryFor(action, ref, data))
      } else if (ops.length > 1) {
        const fields = [...new Set(ops.flatMap((op) => (op.data ? Object.keys(op.data) : [])))]
        const first = ops[0]
        batch.set(auditRef(db), {
          ...entryFor(first.action, first.ref, first.data),
          action: [...new Set(ops.map((op) => op.action))].length === 1 ? first.action : 'batch',
          collection: [...new Set(ops.map((op) => topCollection(op.ref.path)))].join(', '),
          path: '',
          docId: '',
          label: `${ops.length} records`,
          docIds: ops.map((op) => op.ref.id).slice(0, 500),
          fields: fields.slice(0, MAX_FIELDS),
          changes: describeData(first.data).changes,
          count: ops.length,
        })
      }
      return batch.commit()
    },
  }
}
