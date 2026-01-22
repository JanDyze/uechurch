// Simple markdown to HTML converter for basic syntax
export function markdownToHtml(markdown) {
  if (!markdown) return ''
  
  // If it's already HTML (contains HTML tags), return as is
  if (markdown.includes('<') && markdown.includes('>')) {
    return markdown
  }
  
  let html = markdown
  
  // Split into lines for better processing
  const lines = html.split('\n')
  const processedLines = []
  const listStack = [] // Stack to track nested lists: [{type: 'ul'|'ol', level: number}]
  let inTable = false
  
  const getIndentLevel = (line) => {
    const match = line.match(/^(\s*)/)
    return match ? Math.floor(match[1].length / 2) : 0 // 2 spaces = 1 level
  }
  
  const closeListsToLevel = (targetLevel) => {
    while (listStack.length > targetLevel) {
      const list = listStack.pop()
      processedLines.push(list.type === 'ul' ? '</ul>' : '</ol>')
    }
  }
  
  const isTableRow = (line) => {
    return line.trim().match(/^\|.+\|$/) && !line.trim().match(/^\|[\s\-:]+\|$/)
  }
  
  const isTableSeparator = (line) => {
    return line.trim().match(/^\|[\s\-:]+\|$/)
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const indentLevel = getIndentLevel(line)
    const trimmedLine = line.trim()
    
    // Close table if we encounter a non-table line
    if (inTable && !isTableRow(trimmedLine) && !isTableSeparator(trimmedLine)) {
      processedLines.push('</table>')
      inTable = false
    }
    
    // Headings (must be at start of line, no indentation)
    if (trimmedLine.match(/^###\s+(.+)$/)) {
      closeListsToLevel(0)
      // Skip the next line if it's empty (remove extra spacing after heading)
      if (i + 1 < lines.length && lines[i + 1].trim() === '') {
        i++ // Skip the empty line
      }
      processedLines.push(`<h3>${trimmedLine.replace(/^###\s+/, '')}</h3>`)
      continue
    }
    if (trimmedLine.match(/^##\s+(.+)$/)) {
      closeListsToLevel(0)
      // Skip the next line if it's empty (remove extra spacing after heading)
      if (i + 1 < lines.length && lines[i + 1].trim() === '') {
        i++ // Skip the empty line
      }
      processedLines.push(`<h2>${trimmedLine.replace(/^##\s+/, '')}</h2>`)
      continue
    }
    if (trimmedLine.match(/^#\s+(.+)$/)) {
      closeListsToLevel(0)
      // Skip the next line if it's empty (remove extra spacing after heading)
      if (i + 1 < lines.length && lines[i + 1].trim() === '') {
        i++ // Skip the empty line
      }
      processedLines.push(`<h1>${trimmedLine.replace(/^#\s+/, '')}</h1>`)
      continue
    }
    
    // Markdown table handling
    if (isTableRow(trimmedLine)) {
      if (!inTable) {
        processedLines.push('<table class="min-w-full border-collapse border border-gray-300 dark:border-gray-600 my-4">')
        inTable = true
      }
      const cells = trimmedLine.split('|').map(cell => cell.trim()).filter(cell => cell)
      processedLines.push('<tr>')
      // Check if next line is a separator to determine if this is a header row
      const isHeaderRow = i + 1 < lines.length && isTableSeparator(lines[i + 1]?.trim() || '')
      cells.forEach(cell => {
        if (isHeaderRow) {
          processedLines.push(`<th class="border border-gray-300 dark:border-gray-600 px-4 py-2 bg-gray-100 dark:bg-gray-700 font-semibold text-left">${cell}</th>`)
        } else {
          processedLines.push(`<td class="border border-gray-300 dark:border-gray-600 px-4 py-2">${cell}</td>`)
        }
      })
      processedLines.push('</tr>')
      continue
    }
    
    if (isTableSeparator(trimmedLine)) {
      // Table separator row - skip it, we already handled headers
      continue
    }
    
    // Horizontal rule
    if (trimmedLine === '---') {
      closeListsToLevel(0)
      processedLines.push('<hr>')
      continue
    }
    
    // Unordered list item (with or without indentation)
    const ulMatch = trimmedLine.match(/^[\*\-\+]\s+(.+)$/)
    if (ulMatch) {
      closeListsToLevel(indentLevel)
      
      // Open lists up to current level
      while (listStack.length < indentLevel + 1) {
        const currentLevel = listStack.length
        // Check if we should use ul or ol based on context
        // For now, default to ul for bullet items
        listStack.push({ type: 'ul', level: currentLevel })
        processedLines.push('<ul>')
      }
      
      processedLines.push(`<li>${ulMatch[1]}</li>`)
      continue
    }
    
    // Ordered list item (with or without indentation)
    const olMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/)
    if (olMatch) {
      closeListsToLevel(indentLevel)
      
      // Open lists up to current level
      while (listStack.length < indentLevel + 1) {
        const currentLevel = listStack.length
        listStack.push({ type: 'ol', level: currentLevel })
        processedLines.push('<ol>')
      }
      
      processedLines.push(`<li>${olMatch[2]}</li>`)
      continue
    }
    
    // Regular line - only close lists if it's not an empty line
    if (trimmedLine) {
      closeListsToLevel(0)
      processedLines.push(`<p>${trimmedLine}</p>`)
    } else {
      // Empty line - don't close lists, just add spacing
      // Lists should continue across empty lines within the same section
      processedLines.push('<br>')
    }
  }
  
  // Close any remaining open lists
  closeListsToLevel(0)
  
  // Close table if still open
  if (inTable) {
    processedLines.push('</table>')
  }
  
  html = processedLines.join('')
  
  // Convert inline formatting
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/_(.+?)_/g, '<em>$1</em>')
  
  return html
}

