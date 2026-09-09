/**
 * Removes every base64 image left in Firestore.
 *
 *   node scripts/clear-base64-images.mjs --dry-run   # report, change nothing
 *   node scripts/clear-base64-images.mjs             # do it
 *
 * DESTRUCTIVE AND FINAL. A base64 field *is* the picture — there is no copy
 * anywhere else — so what this clears is gone. It writes no backup on purpose;
 * that was the choice made when it was run the first time.
 *
 * Two shapes of removal, and the difference matters:
 *
 *   A field on a record that is about something else — a member, a small
 *   group, a gallery album — is emptied. The record itself is untouched: a
 *   member is a person, not their photograph.
 *
 *   A record that exists only to hold a picture — sgSessionPhotos — is deleted
 *   outright, because an empty one would be a row with nothing in it.
 *
 * Anything already moved to Blob is left alone: only values starting with
 * "data:" are touched, so this is safe to re-run and skips migrated images.
 */
import { loadEnv } from 'vite'
import { pathToFileURL } from 'node:url'

for (const [key, value] of Object.entries(loadEnv('development', process.cwd(), ''))) {
  if (!(key in process.env)) process.env[key] = value
}

const { db } = await import(pathToFileURL('lib/firebaseAdmin.js').href)

const DRY_RUN = process.argv.includes('--dry-run')
const firestore = db()

/** Fields emptied in place, leaving the record itself alone. */
const FIELDS = [
  { collection: 'members', field: 'image' },
  { collection: 'smallGroups', field: 'coverPhoto' },
  { collection: 'gallery_albums', field: 'coverUrl' },
]

/** Collections whose documents exist only to hold one picture. */
const PHOTO_DOCS = [{ collection: 'sgSessionPhotos', field: 'url' }]

const isBase64 = (value) => typeof value === 'string' && value.startsWith('data:')
const kb = (n) => `${Math.round(n / 1024)} KB`

let cleared = 0
let deleted = 0
let bytes = 0

for (const { collection, field } of FIELDS) {
  const snapshot = await firestore.collection(collection).get()
  const hits = snapshot.docs.filter((d) => isBase64(d.data()?.[field]))
  if (!hits.length) {
    console.log(`${collection}.${field}: nothing to clear`)
    continue
  }

  console.log(`${collection}.${field}: ${hits.length} of ${snapshot.size} document(s)`)
  for (const document of hits) {
    const size = document.data()[field].length
    bytes += size
    // An empty string rather than a deleted key: every reader in the app does
    // `data.field || ''`, so this is the shape they already expect for "none".
    if (!DRY_RUN) await document.ref.update({ [field]: '' })
    cleared += 1
    console.log(`  ${DRY_RUN ? 'would clear' : 'cleared'} ${document.id} (${kb(size)})`)
  }
}

for (const { collection, field } of PHOTO_DOCS) {
  const snapshot = await firestore.collection(collection).get()
  const hits = snapshot.docs.filter((d) => isBase64(d.data()?.[field]))
  if (!hits.length) {
    console.log(`${collection}: nothing to delete`)
    continue
  }

  console.log(`${collection}: ${hits.length} of ${snapshot.size} document(s) — deleting whole records`)
  for (const document of hits) {
    const size = document.data()[field].length
    bytes += size
    if (!DRY_RUN) await document.ref.delete()
    deleted += 1
    console.log(`  ${DRY_RUN ? 'would delete' : 'deleted'} ${document.id} (${kb(size)})`)
  }
}

console.log(
  `\n${DRY_RUN ? 'would free' : 'freed'} ${kb(bytes)} — ` +
    `${cleared} field(s) cleared, ${deleted} document(s) deleted`
)
if (DRY_RUN) console.log('--dry-run: nothing was written')
process.exit(0)
