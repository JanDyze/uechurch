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
import { notify } from './notifyService'
import { assigneeLabel, dueLabel } from '../utils/taskUtils'

const TASKS_COLLECTION = 'tasks'

const asStrings = (value) =>
  Array.isArray(value) ? value.filter(Boolean).map(String) : []

// Names are stored alongside the ids, the way a prayer concern stores
// memberName: a row has to read as "Ana Reyes" the instant it arrives, and
// waiting on the members collection to resolve every id would leave the list
// flashing blanks on a cold load.
const normalizeTask = (snapshot) => {
  const data = snapshot.data()
  return {
    id: snapshot.id,
    firestoreId: snapshot.id,
    title: data.title || '',
    details: data.details || '',
    assigneeIds: asStrings(data.assigneeIds),
    assigneeNames: asStrings(data.assigneeNames),
    ministry: data.ministry || '',
    dueDate: data.dueDate || '',
    priority: data.priority || 'normal',
    done: Boolean(data.done),
    doneAt: data.doneAt?.toDate?.() || null,
    doneBy: data.doneBy || '',
    doneByName: data.doneByName || '',
    createdBy: data.createdBy || '',
    createdByName: data.createdByName || '',
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date(),
  }
}

/** Live list, newest written first. The page regroups it by due date. */
export const subscribeToTasks = (callback) => {
  const q = query(collection(db, TASKS_COLLECTION), orderBy('createdAt', 'desc'))

  return onSnapshot(
    q,
    // Dev tickets share this collection (see ticketsService) and are not the
    // church's work; the To-do page is the only place they belong.
    (snapshot) =>
      callback(snapshot.docs.filter((d) => d.data().scope !== 'dev').map(normalizeTask)),
    (error) => {
      console.error('Error subscribing to tasks:', error)
      callback([])
    }
  )
}

/** "For Ana & Ben · due Friday" — who, and when, in one line. */
const describe = (task) =>
  [`For ${assigneeLabel(task)}`, task?.dueDate ? `due ${dueLabel(task.dueDate)}` : '']
    .filter(Boolean)
    .join(' · ')

export const addTask = async (taskData) => {
  try {
    const docRef = await addDoc(collection(db, TASKS_COLLECTION), {
      ...taskData,
      done: Boolean(taskData.done),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })

    // The one push this list earns. A shared to-do list only works if the
    // people on it find out something was added without being told twice —
    // everything after that (an edited date, a ticked box) is the list doing
    // its job, and is deliberately silent.
    notify('task.new', {
      title: taskData.title || 'New task',
      body: describe(taskData),
    })

    return docRef.id
  } catch (error) {
    console.error('Error adding task:', error)
    throw error
  }
}

const refFor = (task) => doc(db, TASKS_COLLECTION, task.firestoreId || task.id)

export const updateTask = async (task, updates) => {
  try {
    await updateDoc(refFor(task), { ...updates, updatedAt: Timestamp.now() })
  } catch (error) {
    console.error('Error updating task:', error)
    throw error
  }
}

/**
 * Tick or untick. Who finished it is recorded rather than inferred, because
 * "done" on a shared list is a claim someone made and the next person to open
 * it will want to know whose.
 */
export const setTaskDone = async (task, done, { uid = '', name = '' } = {}) => {
  try {
    await updateDoc(refFor(task), {
      done,
      doneAt: done ? Timestamp.now() : null,
      doneBy: done ? uid : '',
      doneByName: done ? name : '',
      updatedAt: Timestamp.now(),
    })
  } catch (error) {
    console.error('Error updating task:', error)
    throw error
  }
}

export const deleteTask = async (task) => {
  try {
    await deleteDoc(refFor(task))
  } catch (error) {
    console.error('Error deleting task:', error)
    throw error
  }
}
