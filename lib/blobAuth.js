/**
 * Credentials for the Vercel Blob store, wherever this is running.
 *
 * Connecting a store sets three variables, and the prefix on them is not
 * stable. It depends on the store's name and on what is already connected —
 * across three attempts at the same project this has been BLOB_, BLOB2_ and
 * BLOBS_:
 *
 *   BLOB_READ_WRITE_TOKEN   BLOB2_READ_WRITE_TOKEN   BLOBS_READ_WRITE_TOKEN
 *
 * So the name is discovered rather than written down: anything ending in
 * _READ_WRITE_TOKEN whose prefix starts with BLOB counts. A plain
 * BLOB_READ_WRITE_TOKEN wins when it exists, since that is the first store
 * connected and the least surprising default; the rest are taken in
 * alphabetical order. Recreating the store no longer means editing code.
 *
 * The token is handed to the SDK as an explicit option rather than left to its
 * own lookup, and that is deliberate. It prefers OIDC whenever
 * VERCEL_OIDC_TOKEN and BLOB_STORE_ID are both set, and fails there rather
 * than falling through to a token — so off Vercel, where a pulled OIDC token
 * is scoped to the development environment, a store that does not grant that
 * environment refuses it. Passing the token wins over all of that, and also
 * makes a stale or wrong BLOB_STORE_ID harmless.
 */

const TOKEN_NAME = /^BLOB[A-Z0-9]*_READ_WRITE_TOKEN$/

/** A Blob read-write token, whatever Vercel decided to call it this time. */
export function blobToken(env = process.env) {
  const names = Object.keys(env)
    .filter((name) => TOKEN_NAME.test(name))
    .sort((a, b) => {
      if (a === 'BLOB_READ_WRITE_TOKEN') return -1
      if (b === 'BLOB_READ_WRITE_TOKEN') return 1
      return a.localeCompare(b)
    })

  for (const name of names) {
    const value = (env[name] || '').trim()
    if (value) return value
  }
  return ''
}

/** Spread into a `put`/`del` call: `{ token }` when there is one, else `{}`. */
export function blobAuth(env = process.env) {
  const token = blobToken(env)
  return token ? { token } : {}
}
