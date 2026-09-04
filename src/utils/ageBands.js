// The age bands ministries actually plan around, not even decades.
//
// Shared rather than owned by one screen: the People summary reports on them,
// and the attendance recorder groups its list by them. Two screens disagreeing
// about where "youth" ends would be worse than having no bands at all.

import { calculateAgeFromDate } from './memberUtils'

export const AGE_BANDS = [
  {
    key: 'kids',
    label: 'Kids',
    upTo: 12,
    barClass: 'bg-sky-400 dark:bg-sky-500',
    dotClass: 'bg-sky-400 dark:bg-sky-500',
  },
  {
    key: 'youth',
    label: 'Youth',
    upTo: 25,
    barClass: 'bg-emerald-400 dark:bg-emerald-500',
    dotClass: 'bg-emerald-400 dark:bg-emerald-500',
  },
  {
    key: 'adults',
    label: 'Adults',
    upTo: 59,
    barClass: 'bg-amber-400 dark:bg-amber-500',
    dotClass: 'bg-amber-400 dark:bg-amber-500',
  },
  {
    key: 'seniors',
    label: 'Seniors',
    upTo: Infinity,
    barClass: 'bg-violet-400 dark:bg-violet-500',
    dotClass: 'bg-violet-400 dark:bg-violet-500',
  },
]

/**
 * A stored age wins over the birth date: it is what the rest of the app shows,
 * and some records carry an age with no birth date at all.
 */
export const ageOf = (member) => {
  if (typeof member?.age === 'number' && Number.isFinite(member.age)) return member.age
  const derived = calculateAgeFromDate(member?.dateOfBirth)
  return Number.isFinite(derived) ? derived : null
}

/** The band someone falls in, or null when the record says nothing about age. */
export const bandOf = (member) => {
  const age = ageOf(member)
  if (age === null) return null
  return AGE_BANDS.find((band) => age <= band.upTo) || null
}

/**
 * Where someone sorts when a list is arranged by band. People with no age go
 * last rather than first — an unknown is a gap in the record, not a group, and
 * burying it at the end keeps it out of the way of the checking.
 */
export const bandIndexOf = (member) => {
  const band = bandOf(member)
  return band ? AGE_BANDS.indexOf(band) : AGE_BANDS.length
}

/** The heading a list of people with no usable age sits under. */
export const UNKNOWN_BAND = {
  key: 'unknown',
  label: 'Age not set',
  dotClass: 'bg-gray-300 dark:bg-gray-600',
}

/**
 * Splits `members` into band groups in age order, dropping bands nobody falls
 * in so a small church does not scroll past four empty headings.
 */
export const groupByBand = (members = []) => {
  const buckets = new Map()

  members.forEach((member) => {
    const band = bandOf(member) || UNKNOWN_BAND
    if (!buckets.has(band.key)) buckets.set(band.key, { band, members: [] })
    buckets.get(band.key).members.push(member)
  })

  return [...AGE_BANDS, UNKNOWN_BAND]
    .map((band) => buckets.get(band.key))
    .filter(Boolean)
}
