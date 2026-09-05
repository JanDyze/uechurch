import { db } from './firebase'
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore'
import { ACCOUNT_KEYS, CASH, BANK } from '../data/financeChart'

// A collection of its own, not the `finances` one the module removed in v0.7.0
// wrote to. Documents may well still be sitting there in the old shape — a
// `type: income|expense` with free-text categories — and pointing a new
// normaliser at them would read them wrong rather than read them not at all.
// Nothing there is touched or destroyed; it stays exactly as it was left.
const ENTRIES_COLLECTION = 'ledgerEntries'
const SETTINGS_COLLECTION = 'ledgerSettings'
const OPENING_DOC = 'opening'

const DIRECTIONS = ['in', 'out', 'transfer']

/** Money is only ever an integer count of centavos. */
const toCentavos = (value) => {
  const n = Math.trunc(Number(value))
  return Number.isFinite(n) ? Math.abs(n) : 0
}

const safeAccount = (value, fallback = CASH) =>
  ACCOUNT_KEYS.includes(value) ? value : fallback

const normalizeEntry = (snapshot) => {
  const data = snapshot.data()
  const direction = DIRECTIONS.includes(data.direction) ? data.direction : 'out'
  const account = safeAccount(data.account)

  return {
    id: snapshot.id,
    firestoreId: snapshot.id,
    date: data.date || '',
    description: data.description || '',
    direction,
    // A transfer is defined by the two accounts, so it carries no category.
    category: direction === 'transfer' ? '' : data.category || '',
    subcategory: direction === 'transfer' ? '' : data.subcategory || '',
    account,
    toAccount:
      direction === 'transfer'
        ? safeAccount(data.toAccount, account === BANK ? CASH : BANK)
        : '',
    amount: toCentavos(data.amount),
    payee: data.payee || '',
    notes: data.notes || '',
    createdBy: data.createdBy || '',
    createdByName: data.createdByName || '',
    updatedBy: data.updatedBy || '',
    updatedByName: data.updatedByName || '',
    createdAt: data.createdAt?.toDate?.() || null,
    updatedAt: data.updatedAt?.toDate?.() || null,
  }
}

/** Live list. The page filters it by month and orders it for the screen. */
export const subscribeToEntries = (callback) => {
  const q = query(collection(db, ENTRIES_COLLECTION), orderBy('date', 'desc'))

  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map(normalizeEntry)),
    (error) => {
      console.error('Error subscribing to ledger entries:', error)
      callback([])
    }
  )
}

/** Only the fields an entry is allowed to carry, whatever the caller passed. */
const entryPayload = (entry) => {
  const direction = DIRECTIONS.includes(entry.direction) ? entry.direction : 'out'
  const account = safeAccount(entry.account)
  return {
    date: entry.date || '',
    description: (entry.description || '').trim(),
    direction,
    category: direction === 'transfer' ? '' : entry.category || '',
    subcategory: direction === 'transfer' ? '' : entry.subcategory || '',
    account,
    toAccount:
      direction === 'transfer'
        ? safeAccount(entry.toAccount, account === BANK ? CASH : BANK)
        : '',
    amount: toCentavos(entry.amount),
    payee: (entry.payee || '').trim(),
    notes: (entry.notes || '').trim(),
  }
}

// Who touched the books is recorded rather than inferred. An amount that
// changed after the fact is the one thing anyone will want to trace.
export const addEntry = async (entry, { uid = '', name = '' } = {}) => {
  try {
    const docRef = await addDoc(collection(db, ENTRIES_COLLECTION), {
      ...entryPayload(entry),
      createdBy: uid,
      createdByName: name,
      updatedBy: uid,
      updatedByName: name,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  } catch (error) {
    console.error('Error adding ledger entry:', error)
    throw error
  }
}

const refFor = (entry) => doc(db, ENTRIES_COLLECTION, entry.firestoreId || entry.id)

export const updateEntry = async (entry, updates, { uid = '', name = '' } = {}) => {
  try {
    await updateDoc(refFor(entry), {
      ...entryPayload({ ...entry, ...updates }),
      updatedBy: uid,
      updatedByName: name,
      updatedAt: Timestamp.now(),
    })
  } catch (error) {
    console.error('Error updating ledger entry:', error)
    throw error
  }
}

export const deleteEntry = async (entry) => {
  try {
    await deleteDoc(refFor(entry))
  } catch (error) {
    console.error('Error deleting ledger entry:', error)
    throw error
  }
}

/* ------------------------------------------------------------- opening */

/**
 * The one starting point of the whole ledger: what each account held on
 * `asOf`. Every later month's opening figure rolls forward from here, so it is
 * entered once and then left alone.
 */
const normalizeOpening = (data) => ({
  asOf: data?.asOf || '',
  cash: Math.trunc(Number(data?.cash) || 0),
  bank: Math.trunc(Number(data?.bank) || 0),
  isSet: Boolean(data?.asOf),
  updatedByName: data?.updatedByName || '',
})

export const subscribeToOpening = (callback) => {
  const ref = doc(db, SETTINGS_COLLECTION, OPENING_DOC)

  return onSnapshot(
    ref,
    (snapshot) => callback(normalizeOpening(snapshot.exists() ? snapshot.data() : null)),
    (error) => {
      console.error('Error subscribing to opening balance:', error)
      callback(normalizeOpening(null))
    }
  )
}

export const saveOpening = async ({ asOf, cash, bank }, { uid = '', name = '' } = {}) => {
  try {
    await setDoc(
      doc(db, SETTINGS_COLLECTION, OPENING_DOC),
      {
        asOf: asOf || '',
        cash: Math.trunc(Number(cash) || 0),
        bank: Math.trunc(Number(bank) || 0),
        updatedBy: uid,
        updatedByName: name,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    )
  } catch (error) {
    console.error('Error saving opening balance:', error)
    throw error
  }
}
