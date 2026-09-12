/**
 * Typing "@" in the notes editor and getting the roster.
 *
 * What it inserts is the person's plain name, not "@Joyce Santos". Two
 * reasons: the notes are read back by /api/enhance and written into a record
 * the church files, and neither a formal minute nor a prompt should carry an
 * app's typing shortcut. The "@" is how you reach for a name — the name is
 * what stays. Highlighting is by roster match, so a name typed this way lights
 * up exactly like one typed out in full.
 *
 * The editor is a contenteditable, so all of this is Selection and Range work
 * rather than an input's selectionStart.
 */

import { computed, ref } from 'vue'
import { buildPeopleIndex, memberIdOf } from '../utils/minuteAnnotations'

const fullName = (member) =>
  `${member?.firstName || ''} ${member?.lastName || ''}`.replace(/\s+/g, ' ').trim()

// What gets typed into the notes: the nickname, or the first name. Minutes are
// read by people who know each other, and "Daniel Cruz took the action" is not
// how anyone would have written it by hand.
const shortName = (member) =>
  String(member?.nickname || '').trim() || String(member?.firstName || '').trim() || fullName(member)

const normalise = (text) =>
  String(text || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/**
 * A trigger is "@" at the start of a word, then up to two words of name. Two,
 * because "@joyce san" has to keep matching while "@joyce santos will send the"
 * has to stop — otherwise the picker hangs open over the rest of the sentence.
 */
// The second word may be empty, so pressing space after "@joyce" to reach for
// a surname keeps the list up instead of dismissing it mid-name.
const TRIGGER = /(^|[\s(\[>])@([\p{L}\p{M}'.-]*(?:[ ][\p{L}\p{M}'.-]*){0,1})$/u

export function useMentionPicker(members) {
  const open = ref(false)
  const query = ref('')
  const activeIndex = ref(0)
  const anchor = ref({ top: 0, left: 0, flip: false })
  // The text node and offsets the "@…" occupies, so choosing a name replaces
  // what was typed rather than appending to it.
  let target = null

  const index = computed(() => buildPeopleIndex(members.value || []))

  const matches = computed(() => {
    if (!open.value) return []
    const needle = normalise(query.value).trim()
    const people = (members.value || []).filter((member) => memberIdOf(member) && fullName(member))

    const scored = people
      .map((member) => {
        const formal = fullName(member)
        const name = shortName(member)
        const haystack = normalise(formal)
        const nickname = normalise(member.nickname || '')
        const row = { member, name, formal }
        if (!needle) return { ...row, rank: 2 }
        if (haystack.startsWith(needle) || nickname.startsWith(needle)) return { ...row, rank: 0 }
        // A last-name match still counts, just below a first-name one.
        if (haystack.split(' ').some((word) => word.startsWith(needle))) return { ...row, rank: 1 }
        return null
      })
      .filter(Boolean)
      .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))

    // Six fits above a phone keyboard without becoming a scroll of its own.
    return scored.slice(0, 6).map(({ member, name, formal }) => ({
      id: memberIdOf(member),
      name,
      // Shown under the row, and only where it says something the short name
      // does not — two Joyces, or a nickname nothing like the name on record.
      formal: formal && formal !== name ? formal : '',
      member,
    }))
  })

  const close = () => {
    open.value = false
    query.value = ''
    activeIndex.value = 0
    target = null
  }

  /**
   * Where the caret is on screen, so the list appears under the word being
   * typed. A zero-width caret has no rect of its own in some engines, so it is
   * measured against a collapsed clone that includes the character before it.
   */
  const measure = (range) => {
    let rect = null
    try {
      rect = range.getBoundingClientRect?.() || null
      if (rect && !rect.top && !rect.left) {
        const probe = range.cloneRange()
        probe.setStart(range.startContainer, Math.max(0, range.startOffset - 1))
        rect = probe.getBoundingClientRect()
      }
    } catch {
      rect = null
    }
    // No rect means no anchor to hang the list off — better to leave it where
    // it was than to throw and lose the keystroke that opened it.
    if (!rect) return

    const room = window.innerHeight - rect.bottom
    anchor.value = {
      top: room < 240 ? rect.top - 8 : rect.bottom + 6,
      // Clamped so the list never hangs off a narrow screen.
      left: Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - 248)),
      flip: room < 240,
    }
  }

  /** Called on every input in the editor. */
  const refresh = () => {
    const selection = window.getSelection()
    if (!selection || !selection.isCollapsed || !selection.rangeCount) return close()

    const node = selection.anchorNode
    if (!node || node.nodeType !== 3) return close()

    const before = String(node.textContent || '').slice(0, selection.anchorOffset)
    const match = before.match(TRIGGER)
    if (!match) return close()

    target = {
      node,
      start: before.length - match[2].length - 1, // the "@" itself
      end: selection.anchorOffset,
    }
    query.value = match[2]
    activeIndex.value = 0
    open.value = true
    measure(selection.getRangeAt(0))
  }

  /**
   * Arrow keys and Enter belong to the list while it is open; everything else
   * falls through to the editor. Returns true when the key was consumed.
   */
  const handleKeydown = (event) => {
    if (!open.value || !matches.value.length) {
      if (event.key === 'Escape' && open.value) {
        close()
        return true
      }
      return false
    }

    if (event.key === 'ArrowDown') {
      activeIndex.value = (activeIndex.value + 1) % matches.value.length
      return true
    }
    if (event.key === 'ArrowUp') {
      activeIndex.value = (activeIndex.value - 1 + matches.value.length) % matches.value.length
      return true
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      choose(matches.value[activeIndex.value])
      return true
    }
    if (event.key === 'Escape') {
      close()
      return true
    }
    return false
  }

  /**
   * Swaps the "@…" for the name and leaves the caret after it, with a trailing
   * space so the next word can be typed straight away.
   *
   * @returns {boolean} whether anything was inserted — the caller saves on true
   */
  const choose = (candidate) => {
    if (!candidate || !target) {
      close()
      return false
    }

    const { node, start, end } = target
    const text = String(node.textContent || '')
    // The editor may have moved on since the trigger was measured.
    if (start < 0 || end > text.length) {
      close()
      return false
    }

    const insert = `${candidate.name} `
    node.textContent = text.slice(0, start) + insert + text.slice(end)

    const selection = window.getSelection()
    const range = document.createRange()
    range.setStart(node, start + insert.length)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)

    close()
    return true
  }

  return { open, query, matches, activeIndex, anchor, index, refresh, handleKeydown, choose, close }
}
