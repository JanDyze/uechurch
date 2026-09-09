import { db } from './firebase'
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp
} from 'firebase/firestore'
import { inBatches } from './batchWrite'
import { deleteImages, uploadImage } from './blobService'
import { notify } from './notifyService'

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

    // The album, once — not each photo. Photos arrive in a long upload and one
    // notification per picture would be the worst thing this app could do.
    notify('gallery.album', {
      title: `New album: ${albumData.title || 'Untitled'}`,
      body: [albumData.date, albumData.location].filter(Boolean).join(' · '),
      url: `/gallery/${docRef.id}`,
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
/**
 * Stores one photograph and files it under an album.
 *
 * The bytes go to Blob and the document keeps only the URL they landed
 * at. It used to keep the whole base64 string, which is what capped a
 * picture at the 1 MiB a Firestore document holds and put a function
 * decode in front of every read. `url` is still the field name, and still
 * something an <img> can be pointed at — a migrated photo is an https URL,
 * one that predates this is a data URL, and both render.
 */
export const uploadPhoto = async (albumId, base64Data, description) => {
  try {
    const url = await uploadImage(base64Data, `gallery/${albumId}`)

    // 1. Create photo document
    const photoRef = await addDoc(collection(db, PHOTOS_COLLECTION), {
      albumId,
      url,
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
    // The photographs go with it.
    //
    // They used to be left where they were. Nothing renders an orphan — the
    // public page and the gallery both look a photo's album up before showing
    // it, and the image route refuses one — so the leak was invisible, which
    // is why it lasted: every deleted album left its photos in Firestore for
    // good, each one a base64 blob, each one still counted against every read
    // of the collection the public page makes.
    //
    // Photos first, then the album. That order is the recoverable one: a
    // failure halfway leaves an album that still owns what is left of its
    // photos, and deleting it again finishes the job. The other order would
    // strand them beyond reach of this function.
    const photos = await getDocs(
      query(collection(db, PHOTOS_COLLECTION), where('albumId', '==', albumId))
    )

    // The stored files go too. Deduplicated because an album's cover points at
    // the same blob as one of its photographs, and one list means one request
    // however many pictures the album holds.
    await deleteImages([...new Set(photos.docs.map((photo) => photo.data()?.url))])

    await inBatches(photos.docs, (batch, photo) => batch.delete(photo.ref))

    await deleteDoc(doc(db, ALBUMS_COLLECTION, albumId))
  } catch (error) {
    console.error('Error deleting album:', error)
    throw error
  }
}
/**
 * Delete a specific photo document
 */
export const deletePhoto = async (photoId) => {
  try {
    const photoRef = doc(db, PHOTOS_COLLECTION, photoId)

    // The stored file first, then the document that points at it. That order
    // is the recoverable one: if the delete fails halfway the photo is still
    // listed and can be deleted again, where the reverse would leave bytes in
    // the store with nothing left in the app that knows about them.
    const snapshot = await getDoc(photoRef)
    if (snapshot.exists()) await deleteImages(snapshot.data()?.url)

    await deleteDoc(photoRef)
  } catch (error) {
    console.error('Error deleting photo:', error)
    throw error
  }
}
