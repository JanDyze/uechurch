<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMinutes } from '../composables/useMinutes'
import { useMembers } from '../composables/useMembers'
import { Calendar, Clock, MapPin, Users, Trash2, Download, ArrowLeft, FileText, List, X, Plus, Sparkles, Copy, RotateCcw } from 'lucide-vue-next'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'
import { markdownToHtml } from '../utils/markdownUtils'
import { enhanceMinutesWithHF } from '../utils/minutesEnhancer'

const route = useRoute()
const router = useRouter()
const { minutes, loading, removeMinute, updateMinuteInFirestore } = useMinutes()
const { members } = useMembers()

const showConfirmation = ref(false)
const showAttendeesDrawer = ref(false)
const selectedAgendaIndex = ref(null) // null = summary, number = agenda item index
const newAgendaItem = ref('')
const showAddAgendaModal = ref(false)
const editingContentIndex = ref(null)
const editingContent = ref('')
const editingAgendaIndex = ref(null)
const editingAgendaName = ref('')
const isEnhancing = ref(false)
const isEnhancingOverall = ref(false)
const toastMessage = ref('')
const toastType = ref('success') // 'success' or 'error'
const showToast = ref(false)
const confirmationConfig = ref({
  title: 'Confirm Action',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  confirmButtonClass: 'bg-red-600 text-white hover:bg-red-700',
  onConfirm: null
})

const minute = computed(() => {
  const minuteId = route.params.id
  return minutes.value.find(m => (m.id === minuteId || m.firestoreId === minuteId))
})

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const toRomanNumeral = (num) => {
  if (num <= 0 || num > 3999) return num.toString()
  const romanNumerals = [
    { value: 1000, numeral: 'M' },
    { value: 900, numeral: 'CM' },
    { value: 500, numeral: 'D' },
    { value: 400, numeral: 'CD' },
    { value: 100, numeral: 'C' },
    { value: 90, numeral: 'XC' },
    { value: 50, numeral: 'L' },
    { value: 40, numeral: 'XL' },
    { value: 10, numeral: 'X' },
    { value: 9, numeral: 'IX' },
    { value: 5, numeral: 'V' },
    { value: 4, numeral: 'IV' },
    { value: 1, numeral: 'I' }
  ]
  
  let result = ''
  for (const { value, numeral } of romanNumerals) {
    while (num >= value) {
      result += numeral
      num -= value
    }
  }
  return result
}

const getMemberName = (memberId) => {
  if (!memberId) return 'Unknown'
  const member = members.value?.find(m => 
    String(m.id) === String(memberId) || 
    String(m.firestoreId) === String(memberId) ||
    m.id === memberId || 
    m.firestoreId === memberId
  )
  return member ? `${member.firstName || ''} ${member.lastName || ''}`.trim() : 'Unknown'
}

const selectSummary = () => {
  selectedAgendaIndex.value = null
  // Scroll to the content section
  const contentElement = document.getElementById('agenda-content')
  if (contentElement) {
    contentElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

const selectAgendaItem = (index) => {
  selectedAgendaIndex.value = index
  // Scroll to the content section
  const contentElement = document.getElementById('agenda-content')
  if (contentElement) {
    contentElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

const exportToText = () => {
  if (!minute.value) return
  
  let text = `MEETING MINUTES\n`
  text += `================\n\n`
  text += `Title: ${minute.value.title}\n`
  text += `Date: ${formatDate(minute.value.date)}\n`
  if (minute.value.startTime) {
    text += `Time: ${minute.value.startTime}`
    if (minute.value.endTime) text += ` - ${minute.value.endTime}`
    text += `\n`
  }
  if (minute.value.location) text += `Location: ${minute.value.location}\n`
  text += `\n`
  
  if (minute.value.attendees && minute.value.attendees.length > 0) {
    text += `ATTENDEES:\n`
    minute.value.attendees.forEach(id => {
      text += `- ${getMemberName(id)}\n`
    })
    text += `\n`
  }
  
  // Handle structured data
  if (minute.value.structure) {
    const s = minute.value.structure
    if (s.agenda && s.agenda.length > 0) {
      text += `AGENDA:\n`
      s.agenda.forEach((item, index) => {
        text += `${index + 1}. ${item}\n`
        if (s.discussions && s.discussions[index]) {
          text += `   Discussion: ${s.discussions[index]}\n`
        }
        if (s.decisions && s.decisions[index]) {
          text += `   Decision: ${s.decisions[index]}\n`
        }
        text += `\n`
      })
    }
    
    if (s.actionItems && s.actionItems.length > 0) {
      text += `ACTION ITEMS:\n`
      s.actionItems.forEach((item, index) => {
        text += `${index + 1}. ${item.task}\n`
        if (item.assignee) text += `   Assigned to: ${getMemberName(item.assignee)}\n`
        if (item.dueDate) text += `   Due: ${new Date(item.dueDate).toLocaleDateString()}\n`
        text += `\n`
      })
    }
  } else if (minute.value.content) {
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = minute.value.content
    const textContent = tempDiv.textContent || tempDiv.innerText || ''
    text += `\n${textContent}\n`
  }
  
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${minute.value.title.replace(/[^a-z0-9]/gi, '_')}_${minute.value.date}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const handleDelete = () => {
  if (!minute.value) return
  
  confirmationConfig.value = {
    title: 'Delete Minutes',
    message: `Are you sure you want to delete "${minute.value.title}"? This action cannot be undone.`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    confirmButtonClass: 'bg-red-600 text-white hover:bg-red-700',
    onConfirm: async () => {
      try {
        await removeMinute(minute.value)
        router.push('/minutes')
      } catch (error) {
        console.error('Error deleting minute:', error)
      }
    }
  }
  showConfirmation.value = true
}

const processContent = (content) => {
  if (!content) return ''
  // If content contains markdown syntax, convert it
  if (content.includes('# ') || content.includes('## ') || content.includes('### ')) {
    return markdownToHtml(content)
  }
  return content
}

const handleAddAgendaClick = () => {
  showAddAgendaModal.value = true
  newAgendaItem.value = ''
}

const closeAddAgendaModal = () => {
  showAddAgendaModal.value = false
  newAgendaItem.value = ''
}

const handleAddAgendaSubmit = async () => {
  if (!newAgendaItem.value.trim() || !minute.value) return
  
  try {
    // Get current structure or create new one
    const currentStructure = minute.value.structure || {
      agenda: [],
      discussions: {},
      decisions: {},
      actionItems: []
    }
    
    // Add new agenda item
    const newAgenda = [...(currentStructure.agenda || []), newAgendaItem.value.trim()]
    const newDiscussions = { ...currentStructure.discussions }
    const newDecisions = { ...currentStructure.decisions }
    const newIndex = newAgenda.length - 1
    newDiscussions[newIndex] = ''
    newDecisions[newIndex] = ''
    
    // Update in Firestore
    await updateMinuteInFirestore(minute.value, {
      structure: {
        ...currentStructure,
        agenda: newAgenda,
        discussions: newDiscussions,
        decisions: newDecisions
      }
    })
    
    // Select the newly added item
    selectedAgendaIndex.value = newIndex
    
    closeAddAgendaModal()
  } catch (error) {
    console.error('Error adding agenda item:', error)
  }
}

const handleAgendaNameDblClick = (index) => {
  editingAgendaIndex.value = index
  editingAgendaName.value = currentStructure.value.agenda[index] || ''
}

const handleAgendaNameBlur = async (index) => {
  if (editingAgendaIndex.value !== index) return
  
  try {
    const newName = editingAgendaName.value.trim()
    if (!newName) {
      editingAgendaIndex.value = null
      return
    }
    
    const currentStructure = minute.value.structure || {
      agenda: [],
      discussions: {},
      decisions: {},
      actionItems: []
    }
    
    const newAgenda = [...currentStructure.agenda]
    newAgenda[index] = newName
    
    await updateMinuteInFirestore(minute.value, {
      structure: {
        ...currentStructure,
        agenda: newAgenda
      }
    })
    
    editingAgendaIndex.value = null
    showToastNotification('Agenda name updated')
  } catch (error) {
    console.error('Error updating agenda name:', error)
    editingAgendaIndex.value = null
    showToastNotification('Failed to update agenda name', 'error')
  }
}

const handleDeleteAgendaItem = async (index) => {
  if (!minute.value) return
  
  try {
    const currentStructure = minute.value.structure || {
      agenda: [],
      discussions: {},
      decisions: {},
      actionItems: []
    }
    
    const newAgenda = currentStructure.agenda.filter((_, i) => i !== index)
    const newDiscussions = { ...currentStructure.discussions }
    const newDecisions = { ...currentStructure.decisions }
    
    // Remove discussions and decisions for deleted item and reindex
    const updatedDiscussions = {}
    const updatedDecisions = {}
    newAgenda.forEach((_, newIndex) => {
      const oldIndex = newIndex >= index ? newIndex + 1 : newIndex
      if (newDiscussions[oldIndex] !== undefined) {
        updatedDiscussions[newIndex] = newDiscussions[oldIndex]
      }
      if (newDecisions[oldIndex] !== undefined) {
        updatedDecisions[newIndex] = newDecisions[oldIndex]
      }
    })
    
    await updateMinuteInFirestore(minute.value, {
      structure: {
        ...currentStructure,
        agenda: newAgenda,
        discussions: updatedDiscussions,
        decisions: updatedDecisions
      }
    })
    
    // Select summary or first agenda item
    if (newAgenda.length > 0) {
      selectedAgendaIndex.value = Math.min(index, newAgenda.length - 1)
    } else {
      selectedAgendaIndex.value = null
    }
    
    showToastNotification('Agenda item deleted')
  } catch (error) {
    console.error('Error deleting agenda item:', error)
    showToastNotification('Failed to delete agenda item', 'error')
  }
}

const currentStructure = computed(() => {
  return minute.value?.structure || {
    agenda: [],
    discussions: {},
    decisions: {},
    actionItems: [],
    overallSummary: '' // Overall meeting summary
  }
})

const currentAgendaItem = computed(() => {
  if (selectedAgendaIndex.value === null) return null // Summary is selected
  if (!currentStructure.value.agenda || currentStructure.value.agenda.length === 0) return null
  if (selectedAgendaIndex.value === undefined || selectedAgendaIndex.value < 0) return null
  return {
    index: selectedAgendaIndex.value,
    title: currentStructure.value.agenda[selectedAgendaIndex.value],
    discussion: currentStructure.value.discussions?.[selectedAgendaIndex.value] || '',
    decision: currentStructure.value.decisions?.[selectedAgendaIndex.value] || ''
  }
})

const showSummary = computed(() => selectedAgendaIndex.value === null)

const editableContentRef = ref(null)

const handleContentClick = (index) => {
  // Toggle edit mode: if already editing this index, exit edit mode (blur)
  if (editingContentIndex.value === index) {
    const editableDiv = document.querySelector(`[data-editing-index="${index}"]`)
    if (editableDiv) {
      editableDiv.blur() // This will trigger handleContentBlur
    }
    return
  }
  
  // Enter edit mode
  editingContentIndex.value = index
  const discussion = currentStructure.value.discussions?.[index] || ''
  // Convert markdown to HTML for editing (contenteditable works with HTML)
  // Store original markdown for saving
  let content = ''
  if (discussion) {
    // If it's already HTML, use it; otherwise convert markdown to HTML
    if (discussion.includes('<') && discussion.includes('>')) {
      content = discussion
      editingContent.value = discussion // Store as-is if HTML
    } else {
      // It's markdown, convert to HTML for editing
      content = markdownToHtml(discussion)
      editingContent.value = discussion // Store original markdown
    }
  }
  
  // Set content directly in the DOM to avoid cursor issues
  setTimeout(() => {
    const editableDiv = document.querySelector(`[data-editing-index="${index}"]`)
    if (editableDiv) {
      editableDiv.innerHTML = content
      editableDiv.focus()
      // Move cursor to end
      const range = document.createRange()
      const selection = window.getSelection()
      range.selectNodeContents(editableDiv)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }, 0)
}

const handleContentBlur = async (index) => {
  if (editingContentIndex.value !== index) return
  
  try {
    const currentStructure = minute.value.structure || {
      agenda: [],
      discussions: {},
      decisions: {},
      actionItems: []
    }
    
    const newDiscussions = { ...currentStructure.discussions }
    newDiscussions[index] = editingContent.value
    
    await updateMinuteInFirestore(minute.value, {
      structure: {
        ...currentStructure,
        discussions: newDiscussions
      }
    })
    
    editingContentIndex.value = null
    editingContent.value = ''
  } catch (error) {
    console.error('Error saving content:', error)
  }
}

const handleContentInput = (event) => {
  // Just update the content value, don't re-render
  // The contenteditable div manages its own content
  // Store HTML for now (we'll convert to markdown on save if needed)
  editingContent.value = event.target.innerHTML
}

const copyRawContent = async () => {
  if (!currentAgendaItem.value) return
  
  const index = currentAgendaItem.value.index
  const rawContent = currentStructure.value.discussions?.[index] || ''
  
  if (!rawContent || !rawContent.trim()) {
    showToastNotification('No content to copy', 'error')
    return
  }
  
  try {
    // Get the raw markdown content (not HTML)
    const contentToCopy = rawContent.includes('<') && rawContent.includes('>')
      ? rawContent // If it's HTML, we'll copy as-is for now
      : rawContent // If it's markdown, copy markdown
    
    await navigator.clipboard.writeText(contentToCopy)
    showToastNotification('Content copied to clipboard!')
  } catch (error) {
    console.error('Failed to copy:', error)
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = rawContent
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    showToastNotification('Content copied to clipboard!')
  }
}

const enhanceMinutes = async () => {
  if (!currentAgendaItem.value || isEnhancing.value) return
  
  const index = currentAgendaItem.value.index
  const agendaTitle = currentAgendaItem.value.title
  const rawNotes = currentStructure.value.discussions?.[index] || ''
  
  if (!rawNotes || !rawNotes.trim()) {
    showToastNotification('Please add some notes first before enhancing', 'error')
    return
  }
  
  isEnhancing.value = true
  
  try {
    // Extract plain text from HTML if needed
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = rawNotes
    const plainText = tempDiv.textContent || tempDiv.innerText || rawNotes
    
    // Save original notes to rawDiscussions if not already saved
    const currentStructure = minute.value.structure || {
      agenda: [],
      discussions: {},
      decisions: {},
      actionItems: [],
      rawDiscussions: {}
    }
    
    // Only save to rawDiscussions if it doesn't already exist (preserve first version)
    const rawDiscussions = { ...(currentStructure.rawDiscussions || {}) }
    if (!rawDiscussions[index]) {
      rawDiscussions[index] = rawNotes // Save original before enhancement
    }
    
    // Enhance the notes (returns markdown)
    const enhancedMarkdown = await enhanceMinutesWithHF(agendaTitle, plainText)
    
    // Convert markdown to HTML for display
    const enhancedHtml = markdownToHtml(enhancedMarkdown)
    
    // Save markdown to Firestore (store as markdown, render as HTML)
    const newDiscussions = { ...currentStructure.discussions }
    newDiscussions[index] = enhancedMarkdown // Store markdown
    
    await updateMinuteInFirestore(minute.value, {
      structure: {
        ...currentStructure,
        discussions: newDiscussions,
        rawDiscussions: rawDiscussions // Preserve original notes
      }
    })
    
    // Update the contenteditable div if it's currently being edited
    if (editingContentIndex.value === index) {
      const editableDiv = document.querySelector(`[data-editing-index="${index}"]`)
      if (editableDiv) {
        editableDiv.innerHTML = enhancedHtml
        editingContent.value = enhancedMarkdown // Store markdown for saving
      }
    }
  } catch (error) {
    console.error('Error enhancing minutes:', error)
    showToastNotification('Failed to enhance minutes. Please try again.', 'error')
  } finally {
    isEnhancing.value = false
  }
}

const revertToOriginalNotes = async () => {
  if (!currentAgendaItem.value) return
  
  const index = currentAgendaItem.value.index
  const rawNotes = currentStructure.value.rawDiscussions?.[index]
  
  if (!rawNotes) {
    showToastNotification('No original notes found to revert to', 'error')
    return
  }
  
  try {
    const currentStructure = minute.value.structure || {
      agenda: [],
      discussions: {},
      decisions: {},
      actionItems: [],
      rawDiscussions: {}
    }
    
    const newDiscussions = { ...currentStructure.discussions }
    newDiscussions[index] = rawNotes // Restore original notes
    
    // Update the contenteditable div if it's currently being edited
    if (editingContentIndex.value === index) {
      const editableDiv = document.querySelector(`[data-editing-index="${index}"]`)
      if (editableDiv) {
        // Check if rawNotes is HTML or markdown/plain text
        if (rawNotes.includes('<') && rawNotes.includes('>')) {
          editableDiv.innerHTML = rawNotes
        } else {
          editableDiv.innerHTML = markdownToHtml(rawNotes)
        }
        editingContent.value = rawNotes
      }
    }
    
    await updateMinuteInFirestore(minute.value, {
      structure: {
        ...currentStructure,
        discussions: newDiscussions
      }
    })
    
    showToastNotification('Reverted to original notes')
  } catch (error) {
    console.error('Error reverting notes:', error)
    showToastNotification('Failed to revert notes. Please try again.', 'error')
  }
}

const enhanceOverallSummary = async () => {
  if (!minute.value || isEnhancingOverall.value) return
  
  const structure = currentStructure.value
  if (!structure.agenda || structure.agenda.length === 0) {
    showToastNotification('Please add agenda items first before enhancing overall summary', 'error')
    return
  }
  
  isEnhancingOverall.value = true
  
  try {
    // Collect all discussions from all agenda items
    const allDiscussions = []
    structure.agenda.forEach((agendaTitle, index) => {
      const discussion = structure.discussions?.[index] || ''
      if (discussion && discussion.trim()) {
        // Extract plain text - handle both HTML and markdown
        let plainText = discussion
        if (discussion.includes('<') && discussion.includes('>')) {
          // It's HTML, extract text
          const tempDiv = document.createElement('div')
          tempDiv.innerHTML = discussion
          plainText = tempDiv.textContent || tempDiv.innerText || discussion
        } else {
          // It's markdown or plain text, use as-is but clean up markdown syntax for better AI processing
          plainText = discussion
        }
        allDiscussions.push(`**${agendaTitle}**:\n${plainText}`)
      }
    })
    
    if (allDiscussions.length === 0) {
      showToastNotification('Please add notes to at least one agenda item before enhancing overall summary', 'error')
      isEnhancingOverall.value = false
      return
    }
    
    const combinedNotes = allDiscussions.join('\n\n')
    const meetingTitle = minute.value.title || 'Meeting'
    
    console.log('Generating overall summary from', allDiscussions.length, 'agenda items')
    
    // For overall summary, pass the meeting title as the "agendaTitle" 
    // The AI will detect it's an overall summary based on the content structure
    // Enhance the combined notes - pass meeting title to indicate it's overall summary
    const enhancedMarkdown = await enhanceMinutesWithHF(meetingTitle, combinedNotes)
    
    if (!enhancedMarkdown || !enhancedMarkdown.trim()) {
      throw new Error('AI returned empty summary')
    }
    
    // Save to Firestore
    await updateMinuteInFirestore(minute.value, {
      structure: {
        ...structure,
        overallSummary: enhancedMarkdown // Store markdown
      }
    })
    
    showToastNotification('Overall summary generated successfully!')
  } catch (error) {
    console.error('Error enhancing overall summary:', error)
    showToastNotification(`Failed to enhance overall summary: ${error.message || 'Please try again.'}`, 'error')
  } finally {
    isEnhancingOverall.value = false
  }
}


// Track the current minute ID to detect actual minute changes
const currentMinuteId = ref(null)

// Reset to summary view only when a different minute is loaded
onMounted(() => {
  if (minute.value) {
    currentMinuteId.value = minute.value.id || minute.value.firestoreId
    selectedAgendaIndex.value = null // Start with summary
  }
})

watch(() => minute.value, (newMinute, oldMinute) => {
  // Only reset if it's a different minute (by ID), not just an update
  const newMinuteId = newMinute?.id || newMinute?.firestoreId
  const oldMinuteId = oldMinute?.id || oldMinute?.firestoreId
  
  if (newMinuteId && newMinuteId !== currentMinuteId.value) {
    // Different minute loaded - reset to summary
    currentMinuteId.value = newMinuteId
    selectedAgendaIndex.value = null
  }
  // If it's the same minute (just updated), keep the current selection
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between pb-4">
        <div class="flex items-center gap-4 flex-1 min-w-0">
          <button
            @click="router.push('/minutes')"
            class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 flex-shrink-0"
          >
            <ArrowLeft class="h-5 w-5" />
          </button>
          <div class="flex-1 min-w-0">
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white truncate">
              {{ minute?.title || 'Meeting Minutes' }}
            </h1>
            <div class="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
              <span v-if="minute?.date" class="flex items-center gap-1">
                <Calendar class="h-4 w-4" />
                {{ formatDate(minute.date) }}
              </span>
              <span v-if="minute?.startTime" class="flex items-center gap-1">
                <Clock class="h-4 w-4" />
                {{ minute.startTime }}{{ minute.endTime ? ` - ${minute.endTime}` : '' }}
              </span>
              <span v-if="minute?.location" class="flex items-center gap-1">
                <MapPin class="h-4 w-4" />
                <span class="truncate">{{ minute.location }}</span>
              </span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <button
            @click="showAttendeesDrawer = true"
            class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
            :title="`${minute?.attendees?.length || 0} attendees`"
          >
            <Users class="h-5 w-5" />
          </button>
          <button
            @click="exportToText"
            class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
            title="Export"
          >
            <Download class="h-5 w-5" />
          </button>
          <button
            @click="handleDelete"
            class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 dark:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 class="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 overflow-hidden flex">
      <!-- Sidebar - Summary & Agenda -->
      <div v-if="minute" class="w-64 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col flex-shrink-0">
        <!-- Summary Section - Standalone -->
        <div class="p-3 border-b-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50">
          <button
            @click="selectSummary"
            :class="[
              'w-full text-left px-4 py-3 rounded-lg transition-all duration-200 font-semibold',
              showSummary
                ? 'bg-[#01779b] text-white shadow-md'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600'
            ]"
          >
            <div class="flex items-center gap-2">
              <FileText :class="['h-5 w-5', showSummary ? 'text-white' : 'text-[#01779b]']" />
              <span class="text-sm">Meeting Summary</span>
            </div>
          </button>
        </div>
        
        <!-- Agenda Section -->
        <div class="flex-1 flex flex-col overflow-hidden">
          <div class="p-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 z-10">
            <h2 class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <List class="h-3.5 w-3.5" />
              Agenda Items
            </h2>
            <button
              @click="handleAddAgendaClick"
              class="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-[#01779b] transition-colors"
              title="Add agenda item"
            >
              <Plus class="h-4 w-4" />
            </button>
          </div>
          <div class="flex-1 overflow-y-auto">
            <nav class="p-2 space-y-1">
              <div v-if="currentStructure.agenda && currentStructure.agenda.length > 0">
                <button
                  v-for="(item, index) in currentStructure.agenda"
                  :key="index"
                  @click="selectAgendaItem(index)"
                  :class="[
                    'w-full text-left px-3 py-2.5 rounded-md transition-all duration-150 group',
                    selectedAgendaIndex === index
                      ? 'bg-[#01779b] text-white shadow-sm'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 border border-transparent hover:border-gray-200 dark:hover:border-gray-600'
                  ]"
                >
                  <div class="flex items-start gap-2">
                    <span :class="[
                      'text-xs font-bold mt-0.5 flex-shrink-0',
                      selectedAgendaIndex === index 
                        ? 'text-white/90' 
                        : 'text-gray-400 dark:text-gray-500 group-hover:text-[#01779b]'
                    ]">
                      {{ toRomanNumeral(index + 1) }}.
                    </span>
                    <span class="text-sm font-medium leading-snug flex-1">
                      {{ item }}
                    </span>
                  </div>
                </button>
              </div>
              <div v-else class="p-4 text-center">
                <p class="text-xs text-gray-400 dark:text-gray-500">No agenda items</p>
              </div>
            </nav>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="flex-1 overflow-y-auto bg-white dark:bg-gray-800">
        <div v-if="loading" class="flex items-center justify-center h-full">
          <div class="text-center">
            <div class="h-12 w-12 border-4 border-[#01779b] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p class="text-gray-500 dark:text-gray-400">Loading...</p>
          </div>
        </div>
        <div v-else-if="!minute" class="flex items-center justify-center h-full">
          <div class="text-center">
            <FileText class="h-16 w-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
            <h2 class="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">Minute not found</h2>
            <p class="text-gray-500 dark:text-gray-400 mb-4">The minute you're looking for doesn't exist.</p>
            <button
              @click="router.push('/minutes')"
              class="px-4 py-2 bg-[#01779b] text-white rounded-lg hover:bg-[#015a77] transition-colors"
            >
              Back to Minutes
            </button>
          </div>
        </div>
        <div v-else class="p-6">
          <!-- Overall Meeting Summary -->
          <div v-if="showSummary && minute.structure" id="agenda-content">
            <div class="flex items-center justify-between mb-4">
              <h1 class="text-3xl font-bold text-gray-900 dark:text-white">📋 Overall Meeting Summary</h1>
              <button
                @click="enhanceOverallSummary"
                :disabled="isEnhancingOverall"
                class="p-2 bg-[#01779b] text-white rounded-lg hover:bg-[#015a77] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                :title="currentStructure.overallSummary ? 'Re-enhance overall summary' : 'Generate overall summary from all agenda items'"
              >
                <Sparkles class="h-4 w-4" />
              </button>
            </div>
            
            <div
              v-if="currentStructure.overallSummary"
              class="p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white prose prose-sm dark:prose-invert max-w-none [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6 [&_li]:my-1 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2"
            >
              <div v-html="markdownToHtml(currentStructure.overallSummary)"></div>
            </div>
            <div v-else class="p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-center text-gray-500 dark:text-gray-400 min-h-[200px] flex items-center justify-center">
              <div>
                <p class="mb-4">Click "Generate Summary" to create an overall meeting summary from all agenda items.</p>
                <p class="text-sm text-gray-400 dark:text-gray-500">The summary will synthesize information from all agenda items into a strategic, executive-level overview.</p>
              </div>
            </div>
          </div>
          
          <!-- Notepad-style Content for Agenda Items -->
          <div v-else-if="minute.structure && currentStructure.agenda && currentStructure.agenda.length > 0 && currentAgendaItem" id="agenda-content">
            <div v-if="currentAgendaItem" class="notepad-section">
              <!-- Agenda Item as H1 -->
              <div class="flex items-center justify-between mb-4">
                <div class="flex-1">
                  <input
                    v-if="editingAgendaIndex === currentAgendaItem.index"
                    v-model="editingAgendaName"
                    @blur="handleAgendaNameBlur(currentAgendaItem.index)"
                    @keyup.enter="handleAgendaNameBlur(currentAgendaItem.index)"
                    @keyup.esc="editingAgendaIndex = null"
                    class="text-3xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-[#01779b] focus:outline-none w-full"
                    autofocus
                  />
                  <h1
                    v-else
                    @dblclick="handleAgendaNameDblClick(currentAgendaItem.index)"
                    class="text-3xl font-bold text-gray-900 dark:text-white cursor-text hover:text-[#01779b] dark:hover:text-[#01779b] transition-colors"
                    title="Double-click to edit"
                  >
                    {{ toRomanNumeral(currentAgendaItem.index + 1) }}. {{ currentAgendaItem.title }}
                  </h1>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    v-if="currentStructure.discussions?.[currentAgendaItem.index]"
                    @click="copyRawContent"
                    class="p-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    title="Copy raw content"
                  >
                    <Copy class="h-4 w-4" />
                  </button>
                  <button
                    v-if="currentStructure.rawDiscussions?.[currentAgendaItem.index]"
                    @click="revertToOriginalNotes"
                    class="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
                    title="Revert to original notes"
                  >
                    <RotateCcw class="h-4 w-4" />
                  </button>
                  <button
                    v-if="currentStructure.discussions?.[currentAgendaItem.index]"
                    @click="enhanceMinutes"
                    :disabled="isEnhancing"
                    class="p-2 bg-[#01779b] text-white rounded-lg hover:bg-[#015a77] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Enhance notes with AI"
                  >
                    <Sparkles class="h-4 w-4" />
                  </button>
                  <button
                    @click="handleDeleteAgendaItem(currentAgendaItem.index)"
                    class="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                    title="Delete agenda item"
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <!-- Editable Content Area -->
              <div
                v-if="editingContentIndex === currentAgendaItem.index"
                :data-editing-index="currentAgendaItem.index"
                ref="editableContentRef"
                contenteditable="true"
                @input="handleContentInput"
                @blur="handleContentBlur(currentAgendaItem.index)"
                class="min-h-[200px] p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#01779b] text-gray-900 dark:text-white prose prose-sm dark:prose-invert max-w-none [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6 [&_li]:my-1 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2"
              ></div>
              <div
                v-else
                @dblclick="handleContentClick(currentAgendaItem.index)"
                class="min-h-[200px] p-4 border border-transparent hover:border-gray-300 dark:hover:border-gray-600 rounded-lg cursor-text text-gray-900 dark:text-white prose prose-sm dark:prose-invert max-w-none [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6 [&_li]:my-1 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2"
                :class="{
                  'bg-gray-50 dark:bg-gray-700/50': currentStructure.discussions?.[currentAgendaItem.index],
                  'text-gray-400 dark:text-gray-500 italic': !currentStructure.discussions?.[currentAgendaItem.index]
                }"
              >
                <div v-if="currentStructure.discussions?.[currentAgendaItem.index]">
                  <div v-html="currentStructure.discussions[currentAgendaItem.index].includes('<') ? currentStructure.discussions[currentAgendaItem.index] : markdownToHtml(currentStructure.discussions[currentAgendaItem.index])"></div>
                </div>
                <div v-else class="select-none">Click to add notes...</div>
              </div>
            </div>

            <!-- Action Items -->
            <div v-if="currentStructure.actionItems && currentStructure.actionItems.length > 0" class="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <FileText class="h-5 w-5" />
                Action Items
              </h2>
              <div class="space-y-3">
                <div
                  v-for="(item, index) in currentStructure.actionItems"
                  :key="index"
                  class="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
                >
                  <p class="font-medium text-gray-900 dark:text-white mb-2">{{ index + 1 }}. {{ item.task }}</p>
                  <div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <span v-if="item.assignee">Assigned to: {{ getMemberName(item.assignee) }}</span>
                    <span v-if="item.dueDate">Due: {{ new Date(item.dueDate).toLocaleDateString() }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Legacy Content -->
          <div v-else-if="minute.content" class="prose prose-sm dark:prose-invert max-w-none">
            <div class="text-sm text-gray-700 dark:text-gray-300" v-html="processContent(minute.content)"></div>
          </div>

          <div v-else class="text-center py-12">
            <p class="text-sm text-gray-500 dark:text-gray-400 italic">No content recorded for this meeting.</p>
          </div>
        </div>
      </div>

      <!-- Attendees Drawer -->
      <Transition name="drawer">
        <div
          v-if="showAttendeesDrawer && minute"
          class="attendees-drawer border-l-4 border-[#01779b] bg-white dark:bg-gray-800 max-w-md w-80 h-full flex flex-col flex-shrink-0 shadow-2xl"
        >
          <!-- Header -->
          <div class="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Users class="h-5 w-5" />
              Attendees
            </h3>
            <button
              @click="showAttendeesDrawer = false"
              class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-6">
            <div v-if="minute.attendees && minute.attendees.length > 0" class="space-y-3">
              <div
                v-for="attendeeId in minute.attendees"
                :key="attendeeId"
                class="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <p class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ getMemberName(attendeeId) }}
                </p>
              </div>
            </div>
            <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">
              <Users class="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p class="text-sm">No attendees recorded</p>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Add Agenda Modal -->
    <Transition name="modal">
      <div
        v-if="showAddAgendaModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        @click.self="closeAddAgendaModal"
      >
        <div
          class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full"
          @click.stop
        >
          <!-- Header -->
          <div class="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Add Agenda Item</h3>
            <button
              @click="closeAddAgendaModal"
              class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="px-6 py-4">
            <input
              v-model="newAgendaItem"
              @keyup.enter="handleAddAgendaSubmit"
              @keydown.esc="closeAddAgendaModal"
              type="text"
              placeholder="Enter agenda item..."
              class="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#01779b] focus:border-transparent"
              autofocus
            />
          </div>

          <!-- Footer -->
          <div class="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
            <button
              @click="closeAddAgendaModal"
              class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              @click="handleAddAgendaSubmit"
              :disabled="!newAgendaItem.trim()"
              class="px-4 py-2 bg-[#01779b] text-white rounded-lg hover:bg-[#015a77] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Confirmation Modal -->
    <ConfirmationModal
      :show="showConfirmation"
      :title="confirmationConfig.title"
      :message="confirmationConfig.message"
      :confirm-text="confirmationConfig.confirmText"
      :cancel-text="confirmationConfig.cancelText"
      :confirm-button-class="confirmationConfig.confirmButtonClass"
      @update:show="showConfirmation = $event"
      @confirm="confirmationConfig.onConfirm"
      @cancel="showConfirmation = false"
    />
    
    <!-- Toast Notification -->
    <Transition
      enter-active-class="transition ease-out duration-300"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="showToast"
        :class="[
          'fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2',
          toastType === 'success' 
            ? 'bg-green-500 text-white' 
            : 'bg-red-500 text-white'
        ]"
      >
        <span>{{ toastMessage }}</span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.attendees-drawer {
  transition: max-width 0.3s ease-out, opacity 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}

.drawer-enter-from.attendees-drawer,
.drawer-leave-to.attendees-drawer {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.notepad-section [contenteditable] {
  outline: none;
}

.notepad-section [contenteditable]:focus {
  outline: none;
}

.notepad-section [contenteditable] h1,
.notepad-section [contenteditable] h2,
.notepad-section [contenteditable] h3 {
  font-weight: 600;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

.notepad-section [contenteditable] h1 {
  font-size: 1.875rem;
}

.notepad-section [contenteditable] h2 {
  font-size: 1.5rem;
}

.notepad-section [contenteditable] h3 {
  font-size: 1.25rem;
}

.notepad-section [contenteditable] ul,
.notepad-section [contenteditable] ol {
  margin-left: 1.5rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

.notepad-section [contenteditable] li {
  margin-bottom: 0.25rem;
}

.notepad-section [contenteditable] strong {
  font-weight: 700;
}

.notepad-section [contenteditable] em {
  font-style: italic;
}
</style>
