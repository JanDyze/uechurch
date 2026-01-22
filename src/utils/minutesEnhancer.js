/**
 * Utility to enhance meeting notes using intelligent client-side formatting
 * Since free AI APIs have CORS restrictions, this uses smart text processing
 * to structure and enhance meeting notes without requiring a backend
 */

/**
 * Enhance agenda notes using Hugging Face Inference API
 * @param {string} agendaTitle - The agenda item title
 * @param {string} rawNotes - The raw notes to enhance
 * @returns {Promise<string>} Enhanced, structured minutes
 */
export async function enhanceMinutesWithHF(agendaTitle, rawNotes) {
  if (!rawNotes || !rawNotes.trim()) {
    throw new Error('No notes provided to enhance')
  }

  // Use Hugging Face Inference API through Vite proxy to avoid CORS issues
  const model = 'mistralai/Mistral-7B-Instruct-v0.2'
  
  const prompt = `Transform the following meeting notes into professional, structured minutes for the agenda item "${agendaTitle}".

Raw Notes:
${rawNotes}

Please format the output as HTML with:
- A clear summary of the discussion
- Key decisions made (if any)
- Action items with responsible parties (if any)
- Next steps (if any)

Make it professional and well-structured. Use HTML tags like <h2>, <h3>, <p>, <ul>, <li>. If there are no decisions or action items, simply provide a clear summary of the discussion.`

  try {
    // Use backend proxy server (runs on port 3001)
    // In development: http://localhost:3001/api/enhance
    // With ngrok: use the ngrok URL for the backend server
    const backendUrl = import.meta.env.VITE_AI_BACKEND_URL || 'http://localhost:3001'
    const apiUrl = `${backendUrl}/api/enhance`
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agendaTitle,
        rawNotes
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error || `API error: ${response.status}`
      
      // For 410, 503, or other errors, fall back to intelligent formatting
      if (response.status === 410 || response.status === 503 || response.status >= 500) {
        console.warn('AI service unavailable, using fallback formatting:', errorMessage)
        return enhanceMinutesWithSimpleModel(agendaTitle, rawNotes)
      }
      
      throw new Error(errorMessage)
    }

    const data = await response.json()
    
    // Backend returns { enhanced: "..." }
    if (data.enhanced) {
      return data.enhanced
    }
    
    throw new Error('Unexpected response format')
  } catch (error) {
    console.error('Error enhancing minutes with AI:', error)
    // Fallback to intelligent formatting
    return enhanceMinutesWithSimpleModel(agendaTitle, rawNotes)
  }
}

/**
 * Enhanced text formatting with intelligent structure detection
 * This provides professional formatting by analyzing and organizing the notes
 * @param {string} agendaTitle - The agenda item title
 * @param {string} rawNotes - The raw notes to enhance
 * @returns {Promise<string>} Formatted minutes
 */
async function enhanceMinutesWithSimpleModel(agendaTitle, rawNotes) {
  // Clean and normalize the input
  const cleanNotes = rawNotes.trim()
  const lines = cleanNotes.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  
  // Pattern matching for different types of content
  const decisions = []
  const actionItems = []
  const discussion = []
  const keyPoints = []
  
  lines.forEach((line, index) => {
    const lowerLine = line.toLowerCase()
    const originalLine = line
    
    // Detect decisions (various patterns)
    if (lowerLine.match(/decided|decision|agreed|approved|resolved|concluded/i) ||
        lowerLine.startsWith('decision:') || lowerLine.startsWith('decided:')) {
      decisions.push(originalLine)
    }
    // Detect action items (various patterns)
    else if (lowerLine.match(/action|todo|task|assign|follow.?up|next step|will do|need to/i) ||
             lowerLine.startsWith('-') || lowerLine.startsWith('•') || 
             lowerLine.match(/^\d+[\.\)]/) || lowerLine.includes('@') || lowerLine.includes('due:')) {
      actionItems.push(originalLine)
    }
    // Detect key points (questions, important statements)
    else if (lowerLine.match(/important|key|note|remember|highlight|question|asked/i) ||
             lowerLine.includes('?') || lowerLine.length > 100) {
      keyPoints.push(originalLine)
    }
    // Everything else is discussion
    else {
      discussion.push(originalLine)
    }
  })
  
  // Build structured output
  let formatted = `<h2>Summary</h2>\n`
  
  // Create a concise summary (first 2-3 sentences or first 150 chars)
  const summaryText = discussion.length > 0 
    ? discussion.slice(0, 3).join(' ').substring(0, 200) + (discussion.slice(0, 3).join(' ').length > 200 ? '...' : '')
    : keyPoints.slice(0, 2).join(' ').substring(0, 200) + (keyPoints.slice(0, 2).join(' ').length > 200 ? '...' : '')
  
  formatted += `<p>${summaryText || 'Discussion notes recorded for this agenda item.'}</p>\n\n`
  
  // Discussion section
  if (discussion.length > 0) {
    formatted += `<h3>Discussion</h3>\n<ul>\n`
    discussion.forEach(point => {
      // Clean up bullet points if they're already there
      const cleanPoint = point.replace(/^[-•*]\s*/, '').trim()
      formatted += `<li>${cleanPoint}</li>\n`
    })
    formatted += `</ul>\n\n`
  }
  
  // Key Points section (if any)
  if (keyPoints.length > 0) {
    formatted += `<h3>Key Points</h3>\n<ul>\n`
    keyPoints.forEach(point => {
      const cleanPoint = point.replace(/^[-•*]\s*/, '').trim()
      formatted += `<li><strong>${cleanPoint}</strong></li>\n`
    })
    formatted += `</ul>\n\n`
  }
  
  // Decisions section
  if (decisions.length > 0) {
    formatted += `<h3>Decisions</h3>\n<ul>\n`
    decisions.forEach(decision => {
      const cleanDecision = decision.replace(/^(decision|decided):\s*/i, '').trim()
      formatted += `<li>${cleanDecision}</li>\n`
    })
    formatted += `</ul>\n\n`
  } else {
    formatted += `<h3>Decisions</h3>\n<p><em>No specific decisions were made during this discussion.</em></p>\n\n`
  }
  
  // Action Items section
  if (actionItems.length > 0) {
    formatted += `<h3>Action Items</h3>\n<ul>\n`
    actionItems.forEach(item => {
      // Clean up common prefixes
      const cleanItem = item
        .replace(/^(action|todo|task):\s*/i, '')
        .replace(/^[-•*]\s*/, '')
        .trim()
      formatted += `<li>${cleanItem}</li>\n`
    })
    formatted += `</ul>`
  } else {
    formatted += `<h3>Action Items</h3>\n<p><em>No action items were identified during this discussion.</em></p>`
  }
  
  return formatted
}

/**
 * Alternative: Use OpenAI-compatible free API (like Together AI or similar)
 * This is a placeholder for future implementation
 */
export async function enhanceMinutesWithOpenAI(agendaTitle, rawNotes, apiKey) {
  // Implementation for OpenAI-compatible APIs
  // This would require an API key
  throw new Error('OpenAI enhancement not yet implemented')
}

