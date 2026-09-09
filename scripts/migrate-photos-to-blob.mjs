/**
 * Moves gallery photographs out of Firestore documents and into Vercel Blob.
 *
 *   node scripts/migrate-photos-to-blob.mjs --dry-run   # look, change nothing
 *   node scripts/migrate-photos-to-blob.mjs             # do it
 *
 * Safe to stop and re-run. A photo is only touched when its `url` is still a
 * base64 data URL, so anything already moved is skipped on the next pass, and
 * a run that dies halfway leaves every remaining photo exactly as it was.
 *
 * Order per photo: upload the bytes, then point the document at them. Never the
 * reverse — a document rewritten before its upload succeeded would be a photo
 * the app can no longer find.
 *
 * Needs FIREBASE_SERVICE_ACCOUNT and a Blob read-write token in .env.local or
 * .env. Both arrive from `vercel env pull` once the store is connected to the
 * Development environment.
 */
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { loadEnv } from 'vite'
import { blobAuth, blobToken } from '../lib/blobAuth.js'

// Vite's loader rather than a hand-rolled one: it already resolves .env against
// .env.local in the right order and unquotes values the way dotenv does. That
// matters here — FIREBASE_SERVICE_ACCOUNT is a quoted JSON blob, and naive
// quote-stripping turns it into something JSON.parse will not take. The empty
// prefix is what vite.config.js passes for the same reason: these are read from
// process.env by server code, not through import.meta.env.
for (const [key, value] of Object.entries(loadEnv('development', process.cwd(), ''))) {
  if (!(key in process.env)) process.env[key] = value
}

const { put } = await import('@vercel/blob')
const { db } = await import(pathToFileURL('lib/firebaseAdmin.js').href)

const DRY_RUN = process.argv.includes('--dry-run')

// This always runs off Vercel, so it always needs a read-write token — see
// lib/blobAuth.js for why the OIDC pair will not do here.
if (!DRY_RUN && !blobToken()) {
  console.error(
    'No Blob read-write token found.\n\n' +
      'Looked for BLOB_READ_WRITE_TOKEN and BLOB2_/BLOB3_… variants. Connect the\n' +
      'store to the Development environment, then:\n\n' +
      '  vercel env pull .env.local\n'
  )
  process.exit(1)
}

const EXTENSIONS = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/avif': 'avif',
}

const decodeDataUrl = (value) => {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(String(value || ''))
  if (!match) return null
  return { mime: match[1], buffer: Buffer.from(match[2], 'base64') }
}

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`

const firestore = db()
const snapshot = await firestore.collection('gallery_photos').get()

const pending = snapshot.docs.filter((d) => String(d.data()?.url || '').startsWith('data:'))
const already = snapshot.size - pending.length

console.log(`gallery_photos: ${snapshot.size} total`)
console.log(`  already in Blob or empty: ${already}`)
console.log(`  still base64:             ${pending.length}`)
if (DRY_RUN) console.log('\n--dry-run: nothing will be written\n')
if (!pending.length) process.exit(0)

let moved = 0
let bytes = 0
const failed = []

for (const photoDoc of pending) {
  const data = photoDoc.data()
  const decoded = decodeDataUrl(data.url)

  if (!decoded) {
    failed.push([photoDoc.id, 'could not decode the data URL'])
    continue
  }

  const extension = EXTENSIONS[decoded.mime]
  if (!extension) {
    failed.push([photoDoc.id, `unsupported type ${decoded.mime}`])
    continue
  }

  const album = String(data.albumId || 'unfiled').replace(/[^A-Za-z0-9_-]/g, '') || 'unfiled'
  const path = `gallery/${album}/${randomUUID()}.${extension}`

  if (DRY_RUN) {
    console.log(`  would move ${photoDoc.id} -> ${path} (${kb(decoded.buffer.length)})`)
    bytes += decoded.buffer.length
    moved += 1
    continue
  }

  try {
    const blob = await put(path, decoded.buffer, {
      access: 'public',
      contentType: decoded.mime,
      ...blobAuth(),
    })
    // Only now is the document allowed to forget where the bytes were.
    await photoDoc.ref.update({ url: blob.url })

    // An album cover is a copy of one of its photos' URLs, so it has to follow
    // or it keeps pointing at a base64 string this photo no longer holds.
    const albumRef = firestore.collection('gallery_albums').doc(String(data.albumId || ''))
    const albumSnap = data.albumId ? await albumRef.get() : null
    if (albumSnap?.exists && albumSnap.data()?.coverUrl === data.url) {
      await albumRef.update({ coverUrl: blob.url })
    }

    moved += 1
    bytes += decoded.buffer.length
    console.log(`  moved ${photoDoc.id} (${kb(decoded.buffer.length)})`)
  } catch (error) {
    failed.push([photoDoc.id, error?.message || String(error)])
    console.error(`  FAILED ${photoDoc.id}: ${error?.message || error}`)
  }
}

console.log(`\n${DRY_RUN ? 'would move' : 'moved'}: ${moved} photo(s), ${kb(bytes)}`)
if (failed.length) {
  console.log(`failed: ${failed.length}`)
  for (const [id, why] of failed) console.log(`  ${id}: ${why}`)
  console.log('\nRe-run to retry only what is left; nothing already moved is touched again.')
}
process.exit(failed.length ? 1 : 0)
