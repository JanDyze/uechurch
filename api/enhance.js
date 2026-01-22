// Vercel serverless function for AI enhancement
// This replaces the Express server.js endpoint

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const { agendaTitle, rawNotes } = req.body

    if (!rawNotes || !rawNotes.trim()) {
      return res.status(400).json({ error: 'No notes provided' })
    }

    const HF_TOKEN = process.env.HF_TOKEN

    if (!HF_TOKEN) {
      return res.status(500).json({ error: 'HF_TOKEN not configured' })
    }

    // Check if this is an overall summary
    const isOverallSummary = rawNotes.includes('**:\n') && rawNotes.split('**:\n').length > 1

    const prompt = isOverallSummary
      ? `Act as a Church Secretary. Create a High-Level Ministry Summary that synthesizes information from ALL agenda items in this meeting.

### CONTEXT
This is an OVERALL MEETING SUMMARY that combines multiple agenda items. Your task is to create a strategic, ministry-focused overview that:
- Synthesizes themes across all agenda items
- Identifies cross-cutting decisions and outcomes
- Provides a consolidated view of the entire meeting
- Balances practical tasks with spiritual goals and community care
- Uses warm, relational language appropriate for church ministry

### RAW NOTES FROM ALL AGENDA ITEMS
${rawNotes}

### ARCHITECTURE FOR OVERALL SUMMARY
1. **🙏 Opening**: Any opening prayer or devotion mentioned (if in notes)
2. **📌 Meeting Vitals**: Overall meeting sentiment, productivity level, and key theme (1-2 sentences)
3. **🎯 Strategic Outcomes**: Top 3-5 high-level outcomes that span across agenda items
4. **💰 Stewardship & Finances**: Consolidated view of all approved expenses and budget impacts across agenda items
5. **✅ Key Decisions Summary**: Consolidated view of major decisions made across all agenda items
6. **📋 Ministry Action Items**: All action items from all agenda items in one table
   - Task | Servant (Owner) | Timeline | Related Agenda Item
7. **🙏 Prayer & Follow-up**: List any specific people or concerns mentioned for prayer
8. **🔄 Next Meeting Priorities**: What should be prioritized in the next meeting based on this one

### FORMATTING RULES
- Use Markdown tables for the Ministry Action Items
- Use bold text for names, dates, and agenda item references
- Keep tone respectful, encouraging, and warm - appropriate for church ministry
- Use "third-person" when appropriate
- Be CONCISE - this is a ministry summary, not detailed notes
- If a section is empty, write "None mentioned" (church-friendly)
- Use emojis: 🙏 for opening/prayer, 📌 for vitals, 🎯 for outcomes, 💰 for stewardship, ✅ for decisions, 📋 for actions, 🔄 for next priorities, ⛪ for church context
- CRITICAL: ONLY include information explicitly mentioned in the raw notes. DO NOT add, infer, or create information that is not present.
- DO NOT use placeholders like "[Insert Date]", "[Name]", or "[Insert Date]" - if information is missing, write "Not specified" or omit that field entirely
- DO NOT add items to Prayer & Follow-up or Next Steps that were not mentioned in the raw notes
- If no action items are mentioned, write "None identified" instead of creating placeholder tasks
- If no decisions are mentioned, write "None identified" instead of inferring decisions
- If expenses/purchases are mentioned, use the EXACT amounts and items from the notes

### OUTPUT FORMAT
## 🙏 Opening

[Opening prayer or devotion if mentioned in notes, otherwise "None mentioned"]

## 📌 Meeting Vitals

[1-2 sentences: overall sentiment, productivity, key theme]

## 🎯 Strategic Outcomes

- Outcome 1 (may span multiple agenda items)
- Outcome 2
- Outcome 3

## 💰 Stewardship & Finances

- **Total Approved Expenses**: [Total amount if mentioned]
- **Items Purchased/Approved**:
  - Item 1: [Amount] - [Purpose]
  - Item 2: [Amount] - [Purpose]
- **Budget Impact**: [If mentioned in notes]

If no finances mentioned: "None mentioned"

## ✅ Key Decisions Summary

- **Decision**: [High-level decision from raw notes]
  - **Ministry Impact**: [How this serves the church/ministry - from raw notes]
  - **Affects**: [Which agenda items this affects]

## 📋 Ministry Action Items

| Task | Servant | Timeline | Related Agenda |
|------|---------|----------|----------------|
| Task 1 | Name (if mentioned) | Timeline (if mentioned) | Agenda Item 1 |

IMPORTANT: Only include action items explicitly mentioned in the raw notes. If no action items are mentioned, write "None identified" instead of creating placeholder tasks. DO NOT use "[Insert Date]" or "[Name]" - use "Not specified" if information is missing.

## 🙏 Prayer & Follow-up

- Prayer request 1 (from raw notes)
- Prayer request 2 (from raw notes)

If none mentioned: "None mentioned"

## 🔄 Next Meeting Priorities

- Priority 1 (from raw notes)
- Priority 2 (from raw notes)

If none mentioned: "None identified"

Output ONLY the markdown-formatted summary, nothing else.`
      : `Act as a Church Secretary. Transform the raw meeting notes into professional, warm, and organized Ministry Minutes for the agenda item "${agendaTitle}".

### CONTEXT
This is a PER-AGENDA ITEM summary. Focus ONLY on content related to this specific agenda item (e.g., if the agenda is about "Outreach", all content should be related to outreach). Do NOT include opening prayers or devotions - those belong in the overall meeting summary.

### CHURCH MINUTES STRUCTURE
1. **📖 Ministry Purpose**: A brief (2-sentence) summary of this agenda item's goal for the church. Include dates/timeframes if mentioned (e.g., "ANNIVERSARY (9-12)").
2. **💰 Stewardship & Finances**: 
   - Clearly list ALL approved expenses related to this agenda item only.
   - Calculate multipliers correctly (e.g., "2x2000" = ₱4,000).
   - Calculate and state the total by adding ALL expenses.
3. **✅ Key Decisions**: What was agreed upon by the team/committee regarding this specific agenda item.
4. **📋 Ministry Action Items**:
   - Task | Servant (extract from parentheses or after task) | Timeline | Status/Notes (preserve uncertainty/status)
   - Only include action items related to this specific agenda item.
   - Preserve status/uncertainty (e.g., "di pa sure" = "Pending confirmation").
5. **🙏 Prayer & Follow-up**: List any specific people or concerns mentioned for prayer related to this agenda item.
6. **🔄 Alternatives/Options**: If alternatives or options are mentioned, list them here.

### RAW NOTES
${rawNotes}

### CRITICAL RULES - READ CAREFULLY
- ONLY use information that is EXPLICITLY mentioned in the raw notes above
- DO NOT invent, infer, or create information that is not in the raw notes
- DO NOT use placeholders like "[Insert Date]", "[Name]", or "[Insert Date]"
- If information is missing, write "Not specified" or "None identified"
- DO NOT add items to Parking Lot that were not mentioned in the raw notes
- If no action items are mentioned, write "None identified" - DO NOT create fake action items
- If expenses/purchases are mentioned, use the EXACT amounts and items from the notes

### FORMATTING RULES
- Use Markdown tables for the Action Registry if multiple items exist.
- Use bold text for names and dates.
- Keep the tone objective and "third-person" (e.g., "The team agreed" instead of "We agreed").
- If a section is empty, omit it or write "None identified."
- Use emojis consistently: 📌 for vitals, 🎯 for outcomes, ✅ for decisions, 📋 for actions, ⚠️ for risks, 🚗 for parking lot
- ALWAYS use ## for section headings
- Use - for bullet points, 2 spaces for indentation
- Be BRIEF and CONCISE - focus on what matters most
- CRITICAL: ONLY include information explicitly mentioned in the raw notes. DO NOT add, infer, or create information that is not present.
- DO NOT use placeholders like "[Insert Date]", "[Name]", or "[Insert Date]" - if information is missing, write "Not specified" or omit that field entirely
- DO NOT add items to Parking Lot that were not mentioned in the raw notes
- If no action items are mentioned, write "None identified" instead of creating placeholder tasks
- If no decisions are mentioned, write "None identified" instead of inferring decisions
- If expenses or purchases are mentioned, include the exact amounts and items from the notes

### OUTPUT
Generate the structured minutes using this exact format:

## 📖 Ministry Purpose

[Brief 2-sentence summary of this agenda item's goal for the church, based on raw notes. Focus ONLY on this specific agenda item.]

## 💰 Stewardship & Finances

- **Approved Expenses** (related to this agenda item only):
  - Item 1: [Amount] - [Description from notes, including multiplier if mentioned, e.g., "Manggugupit: 2x2000 = ₱4,000"]
  - Item 2: [Amount] - [Description from notes]
  - Item 3: [Amount] - [Description from notes]
  - [Include ALL expenses mentioned, calculate multipliers correctly]
- **Total**: [Calculate total by adding ALL expenses. If multiplier mentioned, calculate it correctly, e.g., "2x2000" = ₱4,000]
- **Purpose**: [How this serves the ministry/church - from notes]

If no finances mentioned: "None mentioned"

## ✅ Key Decisions

- **Decision**: [Decision statement from raw notes related to this agenda item]
  - **Ministry Impact**: [How this decision serves the church/ministry - from raw notes]

## 📋 Ministry Action Items

| Task | Servant | Timeline | Status/Notes |
|------|---------|----------|--------------|
| Task 1 | Name (if mentioned in parentheses or after task) | Timeline (if mentioned) | Status if mentioned (e.g., "pending confirmation") |

OR if only one action item:
- **Task**: [Description from raw notes - related to this agenda item only, preserve uncertainty/status if mentioned]
  - 👤 **Servant**: [Name if mentioned in parentheses or after task, e.g., "(joyce)" = "Joyce", "(youth)" = "Youth", otherwise "Not specified"]
  - 📅 **Timeline**: [Date/timeline if mentioned, otherwise "Not specified"]
  - 📝 **Status**: [Preserve status/uncertainty if mentioned, e.g., "di pa sure" = "Pending confirmation", otherwise omit]

IMPORTANT: 
- Extract ALL action items mentioned, even if they contain uncertainty (e.g., "di pa sure" = include as "Pending confirmation")
- When names are in parentheses or mentioned after tasks, assign them as Servant (e.g., "letter (joyce)" = Servant: Joyce)
- Preserve the original meaning and status of tasks
- If no action items are mentioned, write "None identified" instead of creating placeholder tasks

## 🙏 Prayer & Follow-up

- Prayer request 1 (from raw notes - related to this agenda item)
- Prayer request 2 (from raw notes - related to this agenda item)

If none mentioned: "None mentioned"

## 🔄 Alternatives/Options

- Option 1 (from raw notes if mentioned)
- Option 2 (from raw notes if mentioned)

If no alternatives mentioned: Omit this section entirely

Output ONLY the markdown-formatted minutes, nothing else.`

    // Try multiple models
    const models = [
      'meta-llama/Llama-3.2-3B-Instruct',
      'mistralai/Mistral-7B-Instruct-v0.2',
      'gpt2',
      'microsoft/Phi-3-mini-4k-instruct'
    ]

    let response = null
    let lastError = null
    let workingModel = null

    // Try chat completions endpoint
    for (const tryModel of models) {
      try {
        response = await fetch(
          `https://router.huggingface.co/v1/chat/completions`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${HF_TOKEN}`
            },
            body: JSON.stringify({
              model: tryModel,
              messages: [
                {
                  role: 'system',
                  content: isOverallSummary
                    ? 'You are a Church Secretary. Create strategic, ministry-focused meeting summaries that synthesize information across multiple agenda items with a warm, relational tone.'
                    : 'You are a Church Secretary. Transform raw meeting notes into professional, warm, and organized Ministry Minutes that balance practical tasks with spiritual goals and community care.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              max_tokens: 500,
              temperature: 0.7
            }),
          }
        )

        if (response.ok) {
          workingModel = tryModel
          break
        } else {
          const errorText = await response.text().catch(() => 'Unknown error')
          lastError = { status: response.status, text: errorText }
        }
      } catch (error) {
        lastError = error
        continue
      }
    }

    // If chat completions didn't work, try direct model endpoint
    if (!response || !response.ok) {
      for (const tryModel of models) {
        try {
          response = await fetch(
            `https://router.huggingface.co/hf-inference/models/${tryModel}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${HF_TOKEN}`
              },
              body: JSON.stringify({
                inputs: prompt,
                parameters: {
                  max_new_tokens: 500,
                  temperature: 0.7,
                  return_full_text: false
                }
              }),
            }
          )

          if (response.ok) {
            workingModel = tryModel
            break
          } else {
            const errorText = await response.text().catch(() => 'Unknown error')
            lastError = { status: response.status, text: errorText }
          }
        } catch (error) {
          lastError = error
          continue
        }
      }
    }

    if (!response || !response.ok) {
      const errorText = lastError?.text || lastError?.message || 'Unknown error'

      if (lastError?.status === 503) {
        return res.status(503).json({ error: 'Model is loading, please try again in a moment' })
      }
      if (lastError?.status === 410 || lastError?.status === 404) {
        return res.status(410).json({ error: 'AI models are currently unavailable. The service will use intelligent formatting instead.' })
      }
      return res.status(lastError?.status || 500).json({ error: `AI service error: ${lastError?.status || 'Unknown'}. Using fallback formatting.` })
    }

    const data = await response.json()

    // Extract the generated text
    let enhancedText = ''

    // Chat completions format
    if (data.choices && data.choices[0]?.message?.content) {
      enhancedText = data.choices[0].message.content.trim()
    }
    // Direct model format
    else if (Array.isArray(data) && data[0]?.generated_text) {
      enhancedText = data[0].generated_text.trim()
    } else if (data.generated_text) {
      enhancedText = data.generated_text.trim()
    } else if (typeof data === 'string') {
      enhancedText = data.trim()
    }

    if (!enhancedText) {
      return res.status(500).json({ error: 'Unexpected response format from AI service' })
    }

    return res.status(200).json({ enhanced: enhancedText })
  } catch (error) {
    console.error('Error enhancing notes:', error)
    return res.status(500).json({ error: error.message || 'Failed to enhance notes' })
  }
}

