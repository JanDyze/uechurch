import { db } from './firebase'
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore'

// A claim is a signed-in account asking to be recognised as a particular
// member record. It stays pending until an administrator acts on it; only
// then is `uid` written onto the member document.
const CLAIMS_COLLECTION = 'memberClaims'
const MEMBERS_COLLECTION = 'members'

const normalizeClaim = (docSnap) => {
  const data = docSnap.data()
  return {
    id: docSnap.id,
    firestoreId: docSnap.id,
    uid: data.uid || '',
    email: data.email || '',
    displayName: data.displayName || '',
    memberId: data.memberId || '',
    memberName: data.memberName || '',
    status: data.status || 'pending', // pending | approved | rejected
    note: data.note || '',
    reviewedBy: data.reviewedBy || '',
    reviewedByEmail: data.reviewedByEmail || '',
    reviewedAt: data.reviewedAt?.toDate?.() || null,
    requestedAt: data.requestedAt?.toDate?.() || new Date(),
  }
}

export const subscribeToMemberClaims = (callback) => {
  return onSnapshot(
    collection(db, CLAIMS_COLLECTION),
    (snapshot) => {
      const claims = snapshot.docs.map(normalizeClaim)
      // Newest first, client-side so no composite index is needed.
      claims.sort((a, b) => b.requestedAt - a.requestedAt)
      callback(claims)
    },
    (error) => {
      console.error('Error subscribing to member claims:', error)
      callback([])
    }
  )
}

/**
 * Files a claim for the signed-in user. Any earlier pending claim by the same
 * account is withdrawn first, so one person can never queue up several.
 */
export const requestMemberClaim = async (user, member, memberName) => {
  const existing = await getDocs(
    query(collection(db, CLAIMS_COLLECTION), where('uid', '==', user.uid))
  )
  await Promise.all(
    existing.docs
      .filter((d) => (d.data().status || 'pending') === 'pending')
      .map((d) => deleteDoc(d.ref))
  )

  const docRef = await addDoc(collection(db, CLAIMS_COLLECTION), {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    memberId: String(member.id ?? member.firestoreId),
    memberName,
    status: 'pending',
    note: '',
    requestedAt: Timestamp.now(),
  })
  return docRef.id
}

export const withdrawMemberClaim = async (claimId) => {
  await deleteDoc(doc(db, CLAIMS_COLLECTION, claimId))
}

/**
 * Approves a claim: stamps the uid onto the member document and rejects every
 * other pending claim that would conflict — another account chasing the same
 * member, or this account chasing a different one. A uid maps to one member,
 * and a member to one uid.
 */
export const approveMemberClaim = async (claim, member, reviewer) => {
  await updateDoc(doc(db, MEMBERS_COLLECTION, member.firestoreId), {
    uid: claim.uid,
  })

  await updateDoc(doc(db, CLAIMS_COLLECTION, claim.firestoreId), {
    status: 'approved',
    reviewedBy: reviewer?.uid || '',
    reviewedByEmail: reviewer?.email || '',
    reviewedAt: Timestamp.now(),
  })

  const snapshot = await getDocs(collection(db, CLAIMS_COLLECTION))
  const conflicts = snapshot.docs.filter((d) => {
    if (d.id === claim.firestoreId) return false
    const data = d.data()
    if ((data.status || 'pending') !== 'pending') return false
    return data.uid === claim.uid || String(data.memberId) === String(claim.memberId)
  })

  await Promise.all(
    conflicts.map((d) =>
      updateDoc(d.ref, {
        status: 'rejected',
        note: 'Superseded by an approved claim.',
        reviewedBy: reviewer?.uid || '',
        reviewedByEmail: reviewer?.email || '',
        reviewedAt: Timestamp.now(),
      })
    )
  )
}

export const rejectMemberClaim = async (claim, reviewer, note = '') => {
  await updateDoc(doc(db, CLAIMS_COLLECTION, claim.firestoreId), {
    status: 'rejected',
    note,
    reviewedBy: reviewer?.uid || '',
    reviewedByEmail: reviewer?.email || '',
    reviewedAt: Timestamp.now(),
  })
}

/** Breaks an existing link, freeing both the account and the member record. */
export const unlinkMember = async (member) => {
  await updateDoc(doc(db, MEMBERS_COLLECTION, member.firestoreId), { uid: null })
}
