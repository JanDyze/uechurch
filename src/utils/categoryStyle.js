// The chip colour for a category name, used wherever a list groups itself by
// category — the links page, the song list.
//
// Categories are renameable in Settings, so a colour has to exist for names
// this file has never heard of. Deriving it from the name keeps it the same
// colour on every visit and on everyone's phone.

const NAMED_STYLES = {
  // Links
  Video: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10',
  Social: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/10',
  Resource: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10',
  Document: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10',
  Design: 'text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-500/10',
  Official: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-500/10',
  // Songs
  Praise: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10',
  Hymnal: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-500/10',
  // Both lists have a Worship category, and it is the same worship either way.
  Worship: 'text-primary bg-primary/10 dark:text-primary-light',
}

const FALLBACK_STYLES = [
  'text-teal-600 bg-teal-50 dark:text-teal-400 dark:bg-teal-500/10',
  'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-500/10',
  'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-500/10',
  'text-lime-600 bg-lime-50 dark:text-lime-400 dark:bg-lime-500/10',
  'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-500/10',
]

export const categoryStyle = (category) => {
  if (NAMED_STYLES[category]) return NAMED_STYLES[category]
  let hash = 0
  for (const char of String(category || '')) hash = (hash * 31 + char.charCodeAt(0)) % 9973
  return FALLBACK_STYLES[hash % FALLBACK_STYLES.length]
}
