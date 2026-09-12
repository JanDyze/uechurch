/**
 * The renderer for everything on a minute: the notes someone typed, and the
 * Markdown /api/enhance writes back over them.
 *
 * The old one assembled HTML line by line and then ran `**`, `*`, `_` and `__`
 * regexes over the finished string. Three things followed from that, and all
 * three showed up on real minutes:
 *
 *   - `Prepared by: ______________________`, the last line of every set of
 *     whole-meeting minutes, was eaten by the `__...__` bold rule.
 *   - Nothing was ever escaped, and anything containing "<" was handed back
 *     untouched — so "attendance < 20" rendered as raw source, and a note
 *     could put script into the page it was read on.
 *   - Empty table cells were dropped rather than kept, so an Action Items row
 *     with no timeline shifted its Status left into the wrong column.
 *
 * So: text is escaped first and inline rules only ever run on escaped text.
 * Underscore emphasis is not supported at all — Claude writes `**` and `*`,
 * and `_` in a minute is nearly always a signature rule or a file name.
 */

const escapeHtml = (text) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/**
 * Records written before this file existed hold HTML, not Markdown: the notes
 * editor is a contenteditable, and what it saved on blur was innerHTML. They
 * still have to render. The test is a real block tag rather than the old
 * `includes('<')`, which any comparison in a note would trip.
 */
const LOOKS_LIKE_HTML =
  /<(p|div|br|ul|ol|li|h[1-6]|table|tr|td|th|strong|em|b|i|span|blockquote|hr)\b[^>]*>/i

export const isStoredHtml = (value) => LOOKS_LIKE_HTML.test(String(value || ''))

/* ------------------------------------------------------------------ inline */

// A character no minute will ever contain, used to park code spans while the
// other inline rules run over the text around them.
const SENTINEL = '\u0000'

// Code spans are pulled out before anything else runs and put back at the end,
// so a `**` inside one stays literal.
const applyInline = (escaped) => {
  const codes = []
  let text = escaped.replace(/`([^`\n]+)`/g, (_, code) => {
    codes.push(code)
    return `${SENTINEL}CODE${codes.length - 1}${SENTINEL}`
  })

  // [label](url) — only http(s) and mailto, so a stored `javascript:` href
  // cannot ride in on a pasted note.
  text = text.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, (_, label, href) => {
    const safe = href.replace(/"/g, '%22')
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer" class="text-primary underline">${label}</a>`
  })

  text = text.replace(/\*\*(?!\s)([^\n]+?)(?<!\s)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/(?<![\w*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![\w*])/g, '<em>$1</em>')
  text = text.replace(/~~(?!\s)([^\n]+?)(?<!\s)~~/g, '<s>$1</s>')

  return text.replace(new RegExp(`${SENTINEL}CODE(\\d+)${SENTINEL}`, 'g'), (_, index) => {
    const code = escapeHtml(codes[Number(index)])
    return `<code class="rounded bg-gray-100 px-1 py-0.5 text-[0.9em] dark:bg-gray-700">${code}</code>`
  })
}

/**
 * One text run, ready for the page: escaped, then marked up, then handed to
 * the caller's decorator — which is how names and dates get highlighted
 * without a second pass over finished HTML.
 */
const renderText = (raw, decorate) => {
  const html = applyInline(escapeHtml(raw))
  return decorate ? decorate(html) : html
}

/* ------------------------------------------------------------------- table */

// `a | b || c` keeps the empty cell. The old split dropped it and every column
// after it moved one to the left.
const splitRow = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.replace(/\\\|/g, '|').trim())

const isTableSeparator = (line) =>
  /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(String(line || '').trim())

const isTableRow = (line) => {
  const trimmed = String(line || '').trim()
  return trimmed.startsWith('|') && trimmed.length > 1 && !isTableSeparator(trimmed)
}

const alignmentsOf = (separator) =>
  splitRow(separator).map((cell) => {
    if (/^:-+:$/.test(cell)) return 'center'
    if (/^-+:$/.test(cell)) return 'right'
    return 'left'
  })

const CELL_BASE = 'border border-gray-300 dark:border-gray-600 px-3 py-2 align-top'

/* ------------------------------------------------------------------ blocks */

const HEADING_CLASS = {
  1: 'text-2xl font-bold mt-6 mb-2',
  2: 'text-xl font-bold mt-5 mb-2',
  3: 'text-lg font-semibold mt-4 mb-2',
  4: 'text-base font-semibold mt-3 mb-1',
  5: 'text-sm font-semibold mt-3 mb-1',
  6: 'text-sm font-semibold mt-3 mb-1',
}

const listMarker = (line) => {
  const bullet = line.match(/^\s*([*\-+])\s+(.*)$/)
  if (bullet) return { type: 'ul', text: bullet[2] }
  const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)$/)
  if (numbered) return { type: 'ol', text: numbered[2] }
  return null
}

const indentOf = (line) => Math.floor(line.match(/^ */)[0].length / 2)

/**
 * @param {string} markdown
 * @param {{ decorate?: (html, ) => string, headingIcon?: (text, level) => string }} [options]
 *   `decorate` is handed each rendered text run — see minuteAnnotations.js,
 *   which uses it to wrap the people and dates a minute mentions.
 *   `headingIcon` is handed each rendered heading — see minuteSections.js,
 *   which uses it to mark the standing sections of a minute.
 * @returns {string} HTML
 */
export function markdownToHtml(markdown, options = {}) {
  if (!markdown) return ''
  const source = String(markdown)
  const decorate = options.decorate
  const headingIcon = options.headingIcon

  // Legacy HTML records render as they were saved. Decorating those means
  // walking text nodes rather than text runs, which is annotateHtml's job.
  if (isStoredHtml(source)) return source

  const lines = source.split(/\r?\n/)
  const out = []
  const stack = [] // open lists, innermost last
  let paragraph = []

  const closeLists = (toDepth = 0) => {
    while (stack.length > toDepth) out.push(stack.pop() === 'ul' ? '</ul>' : '</ol>')
  }

  const flushParagraph = () => {
    if (!paragraph.length) return
    // Joined with <br>, not a space. In minutes a line break is nearly always
    // deliberate — an address, a signature block, one figure per line — and
    // reflowing them into a paragraph loses the shape the writer gave them.
    const html = paragraph.map((line) => renderText(line, decorate)).join('<br>')
    out.push(`<p class="my-2 leading-relaxed">${html}</p>`)
    paragraph = []
  }

  const closeAll = () => {
    flushParagraph()
    closeLists(0)
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const trimmed = line.trim()

    // Fenced code
    if (/^```/.test(trimmed)) {
      closeAll()
      const body = []
      i += 1
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        body.push(lines[i])
        i += 1
      }
      out.push(
        `<pre class="my-3 overflow-x-auto rounded-lg bg-gray-100 p-3 text-xs dark:bg-gray-900"><code>${escapeHtml(
          body.join('\n')
        )}</code></pre>`
      )
      continue
    }

    if (!trimmed) {
      // A blank line ends a paragraph but not a list: Claude puts one between
      // bullets often enough that closing the list here would split it in two.
      flushParagraph()
      continue
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      closeAll()
      const level = heading[1].length
      const label = renderText(heading[2], decorate)
      const icon = headingIcon ? headingIcon(heading[2], level) : ''
      out.push(
        icon
          ? `<h${level} class="${HEADING_CLASS[level]} minute-section"><span class="minute-section-mark">${icon}</span><span>${label}</span></h${level}>`
          : `<h${level} class="${HEADING_CLASS[level]}">${label}</h${level}>`
      )
      continue
    }

    // A rule, but not a signature line: `___` is left alone deliberately.
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      closeAll()
      out.push('<hr class="my-4 border-gray-200 dark:border-gray-700">')
      continue
    }

    if (isTableRow(trimmed)) {
      closeAll()
      const header = splitRow(trimmed)
      const hasHeader = i + 1 < lines.length && isTableSeparator(lines[i + 1])
      const align = hasHeader ? alignmentsOf(lines[i + 1]) : header.map(() => 'left')
      const columns = header.length

      // The wrapper is the only thing allowed to scroll sideways on a minute,
      // and it has to be capped at the reading column's width or it grows to
      // fit the table and takes the page with it.
      out.push(
        '<div class="minute-table"><table class="min-w-full border-collapse border border-gray-300 dark:border-gray-600">'
      )

      if (hasHeader) {
        out.push('<thead><tr>')
        header.forEach((cell, index) => {
          out.push(
            `<th class="${CELL_BASE} bg-gray-100 font-semibold text-${align[index] || 'left'} dark:bg-gray-700">${renderText(cell, decorate)}</th>`
          )
        })
        out.push('</tr></thead>')
        i += 1 // consume the separator
      }

      out.push('<tbody>')
      if (!hasHeader) {
        out.push('<tr>')
        header.forEach((cell, index) =>
          out.push(
            `<td class="${CELL_BASE} text-${align[index] || 'left'}">${renderText(cell, decorate)}</td>`
          )
        )
        out.push('</tr>')
      }
      while (i + 1 < lines.length && isTableRow(lines[i + 1])) {
        i += 1
        const cells = splitRow(lines[i])
        out.push('<tr>')
        // Short rows are padded rather than left ragged, so the table keeps
        // its shape when the notes had nothing for the last column.
        for (let column = 0; column < Math.max(columns, cells.length); column += 1) {
          out.push(
            `<td class="${CELL_BASE} text-${align[column] || 'left'}">${renderText(cells[column] || '', decorate)}</td>`
          )
        }
        out.push('</tr>')
      }
      out.push('</tbody></table></div>')
      continue
    }

    if (/^>\s?/.test(trimmed)) {
      closeAll()
      out.push(
        `<blockquote class="my-3 border-l-4 border-gray-300 pl-3 text-gray-600 dark:border-gray-600 dark:text-gray-400">${renderText(
          trimmed.replace(/^>\s?/, ''),
          decorate
        )}</blockquote>`
      )
      continue
    }

    const item = listMarker(line)
    if (item) {
      flushParagraph()
      const depth = indentOf(line)

      closeLists(depth + 1)
      // A list that changes kind at the same depth — bullets under a numbered
      // list — closes and reopens rather than pretending to be the same list.
      if (stack.length === depth + 1 && stack[depth] !== item.type) closeLists(depth)
      while (stack.length < depth + 1) {
        stack.push(item.type)
        out.push(
          item.type === 'ul'
            ? '<ul class="my-2 ml-6 list-disc space-y-1">'
            : '<ol class="my-2 ml-6 list-decimal space-y-1">'
        )
      }

      // `- [ ] task` reads as a checkbox rather than a stray bracket.
      const checkbox = item.text.match(/^\[([ xX])\]\s+(.*)$/)
      if (checkbox) {
        const checked = checkbox[1].toLowerCase() === 'x'
        out.push(
          `<li class="-ml-6 flex list-none items-start gap-2"><input type="checkbox" disabled ${
            checked ? 'checked' : ''
          } class="mt-1 shrink-0"><span${checked ? ' class="line-through opacity-60"' : ''}>${renderText(
            checkbox[2],
            decorate
          )}</span></li>`
        )
      } else {
        out.push(`<li>${renderText(item.text, decorate)}</li>`)
      }
      continue
    }

    closeLists(0)
    paragraph.push(trimmed)
  }

  closeAll()
  return out.join('')
}

/* ------------------------------------------------------------ the way back */

/**
 * The notes editor is a contenteditable, so what a person leaves behind is
 * innerHTML. It used to be saved as innerHTML, and that quietly cost the
 * record its format: one manual tweak turned a written-up minute into a blob
 * of tags, after which re-enhancing it stripped the structure back to plain
 * text and nothing could read its Action Items table any more.
 *
 * So the editor converts back. Markdown is the one stored form; HTML is only
 * ever what the editor needs while someone is typing into it.
 *
 * Browser-only — it parses with the DOM rather than regexes, because regexes
 * over contenteditable output is how the old renderer got into trouble.
 */
export function htmlToMarkdown(html) {
  if (!html) return ''
  if (typeof document === 'undefined') return String(html)

  const root = document.createElement('div')
  root.innerHTML = String(html)

  const inline = (node) => {
    if (node.nodeType === 3) return node.textContent.replace(/\u00a0/g, ' ')
    if (node.nodeType !== 1) return ''

    const kids = Array.from(node.childNodes).map(inline).join('')
    switch (node.tagName) {
      case 'BR':
        return '\n'
      case 'STRONG':
      case 'B':
        return kids.trim() ? `**${kids.trim()}**` : kids
      case 'EM':
      case 'I':
        return kids.trim() ? `*${kids.trim()}*` : kids
      case 'S':
      case 'STRIKE':
      case 'DEL':
        return kids.trim() ? `~~${kids.trim()}~~` : kids
      case 'CODE':
        return kids.trim() ? `\`${kids.trim()}\`` : kids
      case 'A': {
        const href = node.getAttribute('href')
        return href && kids.trim() ? `[${kids.trim()}](${href})` : kids
      }
      // A highlight put on the page by the annotator is decoration, not
      // content: only the name inside it is written back.
      default:
        return kids
    }
  }

  const blocks = []

  const walk = (node, depth = 0, ordinal = null) => {
    if (node.nodeType === 3) {
      const text = node.textContent.replace(/\u00a0/g, ' ').trim()
      if (text) blocks.push(text)
      return
    }
    if (node.nodeType !== 1) return

    const tag = node.tagName

    if (/^H[1-6]$/.test(tag)) {
      blocks.push(`${'#'.repeat(Number(tag[1]))} ${inline(node).trim()}`)
      return
    }
    if (tag === 'HR') {
      blocks.push('---')
      return
    }
    if (tag === 'BLOCKQUOTE') {
      blocks.push(`> ${inline(node).trim()}`)
      return
    }
    if (tag === 'PRE') {
      blocks.push(`\`\`\`\n${node.textContent.replace(/\u00a0/g, ' ')}\n\`\`\``)
      return
    }
    if (tag === 'UL' || tag === 'OL') {
      let count = 1
      for (const child of Array.from(node.children)) {
        if (child.tagName === 'LI') walk(child, depth, tag === 'OL' ? count++ : null)
      }
      return
    }
    if (tag === 'LI') {
      const nested = Array.from(node.children).filter((child) => /^(UL|OL)$/.test(child.tagName))
      const own = Array.from(node.childNodes)
        .filter((child) => !(child.nodeType === 1 && /^(UL|OL)$/.test(child.tagName)))
        .map(inline)
        .join('')
        .trim()
      const marker = ordinal === null ? '-' : `${ordinal}.`
      if (own) blocks.push({ text: `${'  '.repeat(depth)}${marker} ${own}`, list: true })
      nested.forEach((child) => walk(child, depth + 1))
      return
    }
    if (tag === 'TABLE') {
      const rows = Array.from(node.querySelectorAll('tr'))
      if (!rows.length) return
      const cellsOf = (row) =>
        Array.from(row.children).map((cell) => inline(cell).replace(/\|/g, '\\|').trim())
      const head = cellsOf(rows[0])
      const lines = [`| ${head.join(' | ')} |`]
      const isHeader = rows[0].querySelector('th')
      if (isHeader) lines.push(`| ${head.map(() => '---').join(' | ')} |`)
      rows.slice(1).forEach((row) => {
        const cells = cellsOf(row)
        while (cells.length < head.length) cells.push('')
        lines.push(`| ${cells.join(' | ')} |`)
      })
      blocks.push(lines.join('\n'))
      return
    }

    // A container: recurse if it holds blocks, otherwise take it as a
    // paragraph. contenteditable wraps loose lines in DIVs, and those are
    // paragraphs whatever the tag says.
    const hasBlockChild = Array.from(node.children).some((child) =>
      /^(DIV|P|UL|OL|LI|TABLE|H[1-6]|PRE|BLOCKQUOTE|HR)$/.test(child.tagName)
    )
    if (hasBlockChild) {
      Array.from(node.childNodes).forEach((child) => walk(child, depth))
      return
    }

    const text = inline(node).trim()
    if (text) blocks.push(text)
  }

  Array.from(root.childNodes).forEach((child) => walk(child))

  // A blank line between every block, except between the items of one list —
  // which is still valid Markdown, but reads as a mess anywhere the record is
  // copied out to.
  let markdown = ''
  blocks.forEach((block, position) => {
    const { text, list } = typeof block === 'string' ? { text: block, list: false } : block
    if (position) {
      const previous = blocks[position - 1]
      const previousList = typeof previous === 'object' && previous.list
      markdown += list && previousList ? '\n' : '\n\n'
    }
    markdown += text
  })

  return markdown.replace(/\n{3,}/g, '\n\n').trim()
}

export { escapeHtml }
