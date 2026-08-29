import { getFullName } from './memberUtils'

// Accents are common in local names but rarely typed into a Google account,
// so both sides are folded down before comparing.
const normalize = (value) =>
  (value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const tokens = (value) => normalize(value).split(' ').filter((t) => t.length > 1)

/**
 * Scores how well a member's name matches the signed-in account's name.
 * Whole-name equality outranks everything; otherwise it is the count of
 * shared name parts, so "Jan Malinao" beats "Jan Reyes" for "Jan Dyze Malinao".
 * Returns 0 when nothing matches.
 */
export const scoreNameMatch = (accountName, member) => {
  const memberName = getFullName(member)
  if (!accountName || !memberName.trim()) return 0

  if (normalize(accountName) === normalize(memberName)) return 100

  const accountTokens = new Set(tokens(accountName))
  if (accountTokens.size === 0) return 0

  const shared = tokens(memberName).filter((t) => accountTokens.has(t))
  if (shared.length === 0) {
    // Nicknames are how most people are actually known here.
    const nickname = normalize(member.nickname)
    return nickname && accountTokens.has(nickname) ? 1 : 0
  }
  return shared.length
}

/**
 * Members whose name resembles the account name, best first. Members already
 * linked to some other account are left out — they cannot be claimed.
 */
export const suggestMembers = (accountName, members, limit = 3) =>
  members
    .filter((member) => !member.uid)
    .map((member) => ({ member, score: scoreNameMatch(accountName, member) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || getFullName(a.member).localeCompare(getFullName(b.member)))
    .slice(0, limit)
    .map((entry) => entry.member)
