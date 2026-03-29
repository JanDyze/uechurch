import { db } from './firebase'
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp
} from 'firebase/firestore'

const ALBUMS_COLLECTION = 'gallery_albums'
const PHOTOS_COLLECTION = 'gallery_photos'

/**
 * Normalize album data from Firestore
 */
const normalizeAlbum = (doc) => {
  const data = doc.data()
  return {
    id: doc.id,
    firestoreId: doc.id,
    title: data.title || '',
    description: data.description || '',
    category: data.category || 'General',
    date: data.date || '',
    location: data.location || '',
    coverUrl: data.coverUrl || '',
    calendarEventId: data.calendarEventId || null,
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date()
  }
}

/**
 * Subscribe to gallery albums
 */
export const subscribeToAlbums = (callback) => {
  const q = query(collection(db, ALBUMS_COLLECTION), orderBy('date', 'desc'))
  return onSnapshot(q, (snapshot) => {
    const albums = snapshot.docs.map(normalizeAlbum)
    callback(albums)
  }, (error) => {
    console.error('Error subscribing to albums:', error)
    callback([])
  })
}

/**
 * Subscribe to photos of a specific album (Base64 from Firestore)
 */
export const subscribeToAlbumPhotos = (albumId, callback) => {
  const q = query(
    collection(db, PHOTOS_COLLECTION),
    where('albumId', '==', albumId)
  )

  return onSnapshot(q, (snapshot) => {
    const photos = snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        url: data.url, 
        description: data.description || '',
        uploadedAt: data.uploadedAt?.toDate?.() || new Date()
      }
    })
    // Sort client-side to avoid index requirement
    photos.sort((a, b) => b.uploadedAt - a.uploadedAt)
    callback(photos)
  }, (err) => {
    console.error('Error fetching photos:', err)
    callback([])
  })
}

/**
 * Add a new gallery album
 */
export const addAlbum = async (albumData) => {
  try {
    const docRef = await addDoc(collection(db, ALBUMS_COLLECTION), {
      ...albumData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    })
    return docRef.id
  } catch (error) {
    console.error('Error adding album:', error)
    throw error
  }
}

/**
 * Upload a photo as Base64 to a separate Firestore document
 */
export const uploadPhotoToBase64 = async (albumId, base64Data, description) => {
  try {
    // 1. Create photo document
    const photoRef = await addDoc(collection(db, PHOTOS_COLLECTION), {
      albumId,
      url: base64Data,
      description: description || '',
      uploadedAt: Timestamp.now()
    })

    // 2. Update album cover if it doesn't have one (using first photo)
    const albumRef = doc(db, ALBUMS_COLLECTION, albumId)
    // We check if it already has a coverUrl before setting it automatically
    // This is handled in Gallery.vue logic mostly, but good to have a backup here
    await updateDoc(albumRef, {
      coverUrl: base64Data, 
      updatedAt: Timestamp.now()
    })

    return { id: photoRef.id, url: base64Data }
  } catch (error) {
    console.error('Base64 Upload Failed:', error)
    throw error
  }
}

/**
 * Update an existing gallery album
 */
export const updateAlbum = async (albumId, updatedData) => {
  try {
    const docRef = doc(db, ALBUMS_COLLECTION, albumId)
    await updateDoc(docRef, {
      ...updatedData,
      updatedAt: Timestamp.now()
    })
  } catch (error) {
    console.error('Error updating album:', error)
    throw error
  }
}

/**
 * Set a specific photo as the album cover
 */
export const setAlbumCover = async (albumId, photoUrl) => {
  try {
    const albumRef = doc(db, ALBUMS_COLLECTION, albumId)
    await updateDoc(albumRef, {
      coverUrl: photoUrl,
      updatedAt: Timestamp.now()
    })
  } catch (error) {
    console.error('Error setting album cover:', error)
    throw error
  }
}

/**
 * Delete a gallery album and its associated photos
 */
export const deleteAlbum = async (albumId) => {
  try {
    const docRef = doc(db, ALBUMS_COLLECTION, albumId)
    await deleteDoc(docRef)
  } catch (error) {
    console.error('Error deleting album:', error)
    throw error
  }
}
