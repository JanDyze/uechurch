// Who is allowed to receive a notification.
//
// This is the server-side twin of usePermissions.capabilities: an account's
// rights come from the ministries on its member record, mapped through
// rolePermissions, on top of the baseline every signed-in account holds.
// Administrators bypass the whole thing. Keep the two in step — a rule that
// only exists in the browser would let a push carry something to a device
// whose owner cannot open the page it links to.

import { BASELINE_CAPABILITIES } from './capabilities.js'

/**
 * Reads the three collections access is derived from and returns a resolver.
 * One read of each per notification, which is the price of not blasting
 * prayer concerns at the whole congregation.
 */
export async function loadAudience(firestore) {
  const [adminsSnap, rolesSnap, membersSnap] = await Promise.all([
    firestore.collection('appAdmins').get(),
    firestore.collection('rolePermissions').get(),
    firestore.collection('members').select('uid', 'ministries').get(),
  ])

  const admins = new Set(adminsSnap.docs.map((d) => d.id))

  const roleMap = {}
  rolesSnap.docs.forEach((d) => {
    const caps = d.data().capabilities
    roleMap[d.id] = Array.isArray(caps) ? caps : []
  })

  // uid -> ministries. A member record without a uid has no account attached
  // to it yet, so it grants nothing.
  const ministriesByUid = new Map()
  membersSnap.docs.forEach((d) => {
    const { uid, ministries } = d.data()
    if (uid) ministriesByUid.set(uid, Array.isArray(ministries) ? ministries : [])
  })

  const cache = new Map()

  const capabilitiesFor = (uid) => {
    if (cache.has(uid)) return cache.get(uid)
    const granted = new Set(BASELINE_CAPABILITIES)
    ;(ministriesByUid.get(uid) || []).forEach((ministry) => {
      ;(roleMap[ministry] || []).forEach((cap) => granted.add(cap))
    })
    // Managing an area implies seeing it, so a role only ever ticks manage.
    ;[...granted].forEach((cap) => {
      if (cap.endsWith('.manage')) granted.add(cap.replace(/\.manage$/, '.view'))
    })
    cache.set(uid, granted)
    return granted
  }

  return {
    isAdmin: (uid) => admins.has(uid),
    capabilitiesFor,
    /** The shape lib/notifications.js canReceive() expects. */
    contextFor: (uid) =>
      uid
        ? { isAdmin: admins.has(uid), capabilities: capabilitiesFor(uid) }
        : // A device that registered before tokens carried an owner. It gets
          // what any signed-in account gets and nothing gated beyond that,
          // rather than being cut off until someone next opens the app.
          { isAdmin: false, capabilities: new Set(BASELINE_CAPABILITIES) },
  }
}
