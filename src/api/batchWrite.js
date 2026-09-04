import { writeBatch } from 'firebase/firestore'
import { db } from './firebase'

// Applying one label to thirty people used to mean thirty round trips — the
// page sat there while `Promise.all` worked through an array of updateDoc
// calls. Firestore takes 500 writes in a single commit, so a whole
// congregation is one, and a batch either lands or it does not.

export const BATCH_LIMIT = 500

/**
 * Applies `write` to every item, committing in chunks Firestore accepts.
 *
 * Chunks are committed one after another rather than in parallel: the point is
 * to be gentle on the connection a phone in a church hall actually has, and an
 * ordering that fails halfway leaves a comprehensible half-done state rather
 * than a scattered one.
 *
 * @param items  whatever `write` knows how to turn into an operation
 * @param write  (batch, item) => void
 */
export const inBatches = async (items, write) => {
  for (let i = 0; i < items.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    items.slice(i, i + BATCH_LIMIT).forEach((item) => write(batch, item))
    await batch.commit()
  }
}
