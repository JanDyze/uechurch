// How a typed query is read by the search bars.
//
// Two separators, because people arrive with two different questions:
//
//   space   narrows  — "single teacher" is one person who is both
//   comma   gathers  — "choir, ushers" is everyone in either
//
// Space alone could only ever narrow, so asking for two groups at once was
// impossible: "juan, maria" found nobody, because nobody is both. Commas make
// that the normal thing it looks like — and gathering two groups is exactly
// what someone about to tag them needs.
//
// Formally: comma-separated groups are OR'd, and the words inside a group are
// AND'd. "youth male, choir" is (youth AND male) OR choir.

/** Splits a query into groups of terms. Empty groups — a trailing comma being
 *  typed — drop out rather than matching everything. */
export const parseQuery = (query) =>
  String(query || '')
    .toLowerCase()
    .split(',')
    .map((group) => group.split(/\s+/).filter(Boolean))
    .filter((terms) => terms.length > 0)

/**
 * Whether an indexed string satisfies any one group. Matching stays
 * substring-based, so a comma sitting inside a value someone typed out in full
 * — an address, say — splits into two groups that both still find them.
 */
export const matchesQuery = (haystack, groups) =>
  groups.some((terms) => terms.every((term) => haystack.includes(term)))
