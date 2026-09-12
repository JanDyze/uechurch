/**
 * Icons for the sections of a written-up minute.
 *
 * The headings are the same eleven every time — /api/enhance is told to write
 * them in a fixed order — so they can be recognised and given a mark. A page
 * of eleven identical bold lines is read top to bottom whether you wanted the
 * money or the prayer list; a page where Financial Matters carries a wallet
 * and Action Items a checklist is scanned.
 *
 * Icons rather than emoji, deliberately. Emoji would have to live in the
 * stored Markdown to survive, which puts them in the exported text file, in
 * the clipboard, and in whatever the church prints — and a minute filed with
 * a wallet emoji in the heading is not a document anyone wants to hand to a
 * board. These are added at render time; the record stays plain text.
 *
 * Path data comes from the generated icon set rather than being copied, so a
 * regenerated Phosphor set cannot leave a stale glyph here.
 */

import {
  CalendarClockSvg,
  CheckCircle2Svg,
  ChurchSvg,
  ClipboardCheckSvg,
  Clock3Svg,
  FileTextSvg,
  HandHeartSvg,
  ListChecksSvg,
  NotebookPenSvg,
  UsersSvg,
  WalletSvg,
} from '../icons'

/**
 * Heading text, normalised, to its mark and its tint. The tint is a Tailwind
 * colour token pair rather than a class string: it is interpolated into HTML
 * the renderer builds, so it has to be written out in full for Tailwind's
 * scanner to keep the classes in the build.
 */
// Both spellings of every section: the plain headings the prompts write now,
// and the formal ones every minute already filed uses. A renamed heading must
// not quietly lose its mark on last year's records.
const SECTIONS = [
  { match: ['in short', 'summary', 'at a glance', 'in brief'], svg: FileTextSvg, tone: 'primary' },
  {
    match: ['what we talked about', 'discussion', 'discussions', 'business', 'agenda', 'matters arising'],
    svg: NotebookPenSvg,
    tone: 'slate',
  },
  {
    match: ['what we decided', 'decisions', 'decision', 'resolutions'],
    svg: CheckCircle2Svg,
    tone: 'green',
  },
  {
    match: ['who does what', 'action items', 'action item', 'actions'],
    svg: ListChecksSvg,
    tone: 'blue',
  },
  {
    match: ['money', 'financial matters', 'finances', 'budget', 'expenses'],
    svg: WalletSvg,
    tone: 'amber',
  },
  {
    match: ['please pray for', 'prayer concerns', 'prayer requests', 'prayer'],
    svg: HandHeartSvg,
    tone: 'rose',
  },
  {
    match: ['still open', 'for next meeting', 'next meeting', 'carried forward'],
    svg: CalendarClockSvg,
    tone: 'purple',
  },
  {
    match: ['who was there', 'attendance', 'present', 'those present'],
    svg: UsersSvg,
    tone: 'slate',
  },
  // Only on minutes written before the headings were plainened.
  { match: ['call to order', 'opening'], svg: ChurchSvg, tone: 'slate' },
  { match: ['approval of previous minutes', 'previous minutes'], svg: ClipboardCheckSvg, tone: 'slate' },
  { match: ['adjournment', 'closing', 'adjourned'], svg: Clock3Svg, tone: 'slate' },
]

// Written out in full, never assembled from a token, or Tailwind's scanner
// will not find them and the build will ship a page of black-on-white marks.
const TONES = {
  primary: 'text-primary dark:text-primary-light',
  slate: 'text-gray-400 dark:text-gray-500',
  green: 'text-green-600 dark:text-green-400',
  blue: 'text-blue-600 dark:text-blue-400',
  amber: 'text-amber-600 dark:text-amber-400',
  rose: 'text-rose-600 dark:text-rose-400',
  purple: 'text-purple-600 dark:text-purple-400',
}

const normalise = (text) =>
  String(text || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .toLowerCase()
    // "IV. Action Items" and "Action Items (3)" are the same heading.
    .replace(/^[ivxlc]+\s*[.)]\s*/i, '')
    .replace(/^\d+\s*[.)]\s*/, '')
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * The renderer's `headingIcon` hook: an <svg> for a heading it recognises,
 * and nothing at all for one it does not — an unrecognised heading is a
 * heading someone typed themselves, and hanging a wrong icon on it is worse
 * than hanging none.
 *
 * @param {string} text  the heading's rendered HTML
 * @param {number} level  1-6
 * @returns {string} inline SVG, or ''
 */
export function sectionIcon(text, level) {
  // Only the section headings. An "###" under Business is an agenda item's
  // own title and belongs to the meeting, not to this list.
  if (level > 2) return ''

  const name = normalise(text)
  if (!name) return ''

  const section = SECTIONS.find((candidate) => candidate.match.includes(name))
  if (!section) return ''

  return (
    `<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" ` +
    `class="minute-section-icon ${TONES[section.tone] || TONES.slate}">${section.svg}</svg>`
  )
}
