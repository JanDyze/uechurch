import { db } from './firebase'
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  onSnapshot,
  orderBy,
  serverTimestamp
} from 'firebase/firestore'

const SONGS_COLLECTION = 'worshipSongs'

/**
 * Subscribe to all songs, ordered by newest first
 */
export const subscribeToSongs = (callback) => {
  const q = query(collection(db, SONGS_COLLECTION), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => {
    const songs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    callback(songs)
  })
}

/**
 * Add a new song to the database
 */
export const addSong = async (songData) => {
  return await addDoc(collection(db, SONGS_COLLECTION), {
    ...songData,
    createdAt: serverTimestamp()
  })
}

/**
 * Update an existing song
 */
export const updateSong = async (id, songData) => {
  const songRef = doc(db, SONGS_COLLECTION, id)
  return await updateDoc(songRef, songData)
}

/**
 * Delete a song permanently
 */
export const deleteSong = async (id) => {
  const songRef = doc(db, SONGS_COLLECTION, id)
  return await deleteDoc(songRef)
}
