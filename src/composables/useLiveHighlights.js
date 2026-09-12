/**
 * Highlights inside the notes editor, while someone is still typing into it.
 *
 * The obvious way to do this is to re-render the decorated HTML on every
 * keystroke, and it is the wrong way. Rewriting a contenteditable's innerHTML
 * throws the caret to the start, empties the browser's undo stack, and on a
 * phone dismisses the keyboard's suggestion strip and cancels an in-progress
 * autocorrect — which is exactly when minutes are being typed. You would be
 * fighting the editor to decorate it.
 *
 * The CSS Custom Highlight API paints ranges without touching the DOM at all.
 * No nodes move, so there is no caret to restore, no undo to lose, and nothing
 * for an IME to notice. The highlight is drawn over the text the way a
 * spellcheck underline is.
 *
 * Where the API is missing — Chrome before 105, Safari before 17.2 — nothing
 * happens and the marks appear when the editor is closed, which is what used
 * to happen anyway. Nothing is broken by its absence.
 */

import { onBeforeUnmount, watch } from 'vue'
import { findMarks } from '../utils/minuteAnnotations'

const REGISTRY = {
  person: 'uec-person',
  date: 'uec-date',
  place: 'uec-place',
}

export const liveHighlightsSupported = () =>
  typeof CSS !== 'undefined' && typeof CSS.highlights !== 'undefined' && typeof Highlight !== 'undefined'

/**
 * Every text node under `root`, with the offset at which each one starts in
 * the element's whole text. Ranges are addressed by node and offset, and
 * findMarks works on one flat string, so this is the map between them.
 */
const textNodes = (root) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes = []
  let text = ''
  let node
  while ((node = walker.nextNode())) {
    nodes.push({ node, start: text.length })
    text += node.textContent
  }
  return { nodes, text }
}

/** The node and offset a character index falls at. */
const locate = (nodes, index) => {
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    if (index >= nodes[i].start) {
      return { node: nodes[i].node, offset: index - nodes[i].start }
    }
  }
  return null
}

/**
 * @param {import('vue').Ref<HTMLElement|null>} element  the contenteditable
 * @param {() => object} options  what findMarks should look for, read fresh
 *   each time so a correction made mid-edit takes effect on the next keystroke
 * @param {import('vue').Ref<boolean>} active  whether the editor is open
 */
export function useLiveHighlights(element, options, active) {
  let frame = null

  const clear = () => {
    if (!liveHighlightsSupported()) return
    for (const name of Object.values(REGISTRY)) CSS.highlights.delete(name)
  }

  const paint = () => {
    if (!liveHighlightsSupported()) return
    const root = element.value
    if (!root || !active.value) return clear()

    const { nodes, text } = textNodes(root)
    if (!text.trim()) return clear()

    const buckets = { person: [], date: [], place: [] }

    for (const mark of findMarks(text, options())) {
      const from = locate(nodes, mark.start)
      const to = locate(nodes, mark.end)
      if (!from || !to) continue
      try {
        const range = document.createRange()
        range.setStart(from.node, from.offset)
        range.setEnd(to.node, to.offset)
        buckets[mark.kind]?.push(range)
      } catch {
        // A node changed under us between the walk and the range — the next
        // keystroke repaints, so there is nothing to recover here.
      }
    }

    for (const [kind, name] of Object.entries(REGISTRY)) {
      if (buckets[kind].length) CSS.highlights.set(name, new Highlight(...buckets[kind]))
      else CSS.highlights.delete(name)
    }
  }

  /**
   * Coalesced to one paint per frame. Typing fires input faster than the marks
   * can usefully change, and the roster is walked on every pass.
   */
  const refresh = () => {
    if (!liveHighlightsSupported()) return
    if (frame) cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      frame = null
      paint()
    })
  }

  watch(active, (open) => (open ? refresh() : clear()), { immediate: true })

  onBeforeUnmount(() => {
    if (frame) cancelAnimationFrame(frame)
    clear()
  })

  return { refresh, clear, supported: liveHighlightsSupported() }
}
