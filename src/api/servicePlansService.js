import { db } from './firebase'
import { doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'

// What the tech team is actually running on a given Sunday.
//
// Deliberately its own collection rather than more fields on the worship
// lineup. The lineup is the worship team's plan — which songs, in which key,
// led by whom — and it is theirs to edit. A service also contains a reading,
// a notice, a video, a welcome slide: things the worship team never listed and
// should not have to. Keeping them apart means the tech team can build a run
// sheet without touching the musicians' plan, and the musicians can reorder
// their songs without disturbing the run sheet.
//
// Keyed by ISO date, because a service is what gets run. One document per
// Sunday holds the whole run order, so reordering it is a single write.

const PLANS_COLLECTION = 'servicePlans'

/** Every field a run-sheet item may carry, with the shape the presenter expects. */
const normalizeItem = (item, index) => ({
  id: item?.id || `item-${index}`,
  type: item?.type || 'text',
  title: item?.title || '',
  // Songs are stored by reference so a lyric edit reaches every service that
  // sings it, rather than freezing a copy into each Sunday.
  songId: item?.songId || '',
  // Whether this song came off the worship team's lineup or the tech team put
  // it here. An inherited song follows the lineup — it leaves when they drop it
  // — while one added here is the tech team's own and stays. Without this the
  // run sheet cannot tell the two apart, and reconciling would either strand
  // the lineup's changes or trample the operator's.
  fromLineup: item?.fromLineup === true,
  // Everything typed in here: a notice, a welcome slide.
  body: item?.body || '',
  // Scripture, by contrast, is stored resolved: the reference it was looked up
  // by, and the verses as they came back. A verse is not going to be revised
  // the way a lyric is, so there is nothing to gain from looking it up again —
  // and a run sheet that carries its own words is one that still projects when
  // the church wifi is down mid-service.
  reference: item?.reference || '',
  verses: Array.isArray(item?.verses)
    ? item.verses.map((verse) => ({
        chapter: Number(verse?.chapter) || 0,
        verse: Number(verse?.verse) || 0,
        text: verse?.text || '',
      }))
    : [],
  // Where a video or a deck lives, for the operator to open.
  source: item?.source || '',
})

export const subscribeToServicePlan = (date, callback) => {
  if (!date) return () => {}
  return onSnapshot(doc(db, PLANS_COLLECTION, date), (snapshot) => {
    if (!snapshot.exists()) {
      callback(null)
      return
    }
    const data = snapshot.data() || {}
    callback({
      date,
      items: Array.isArray(data.items) ? data.items.map(normalizeItem) : [],
      updatedBy: data.updatedBy || '',
      updatedAt: data.updatedAt?.toDate?.() || null,
    })
  })
}

/**
 * Writes the run order for one service.
 *
 * setDoc rather than updateDoc: the first save for a Sunday is a create, and
 * the caller should not have to know which it is.
 */
export const saveServicePlan = async (date, items, savedBy) => {
  if (!date) throw new Error('A service plan needs a date')
  await setDoc(
    doc(db, PLANS_COLLECTION, date),
    {
      items: (items || []).map(normalizeItem),
      updatedBy: savedBy?.email || savedBy?.uid || '',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

/** Drops the run sheet, which returns that Sunday to following the lineup. */
export const deleteServicePlan = async (date) => {
  if (!date) return
  await deleteDoc(doc(db, PLANS_COLLECTION, date))
}
