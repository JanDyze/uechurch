<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMinutes } from '../composables/useMinutes'
import { useMembers } from '../composables/useMembers'
import { useTasks } from '../composables/useTasks'
import { usePermissions } from '../composables/usePermissions'
import { useAuth } from '../composables/useAuth'
import { getDisplayName, getFullName } from '../utils/memberUtils'
import { Calendar, Clock, MapPin, Users, Trash2, Download, ArrowLeft, FileText, List, X, Plus, Sparkles, Copy, RotateCcw, Menu, Loader2, MoreVertical } from '../icons'
import ConfirmationModal from '../components/common/ConfirmationModal.vue'
import MinuteActionItems from '../components/minutes/MinuteActionItems.vue'
import MinuteWritingPanel from '../components/minutes/MinuteWritingPanel.vue'
import MentionPicker from '../components/minutes/MentionPicker.vue'
import MinuteNavDrawer from '../components/minutes/MinuteNavDrawer.vue'
import MinuteAttendanceDrawer from '../components/minutes/MinuteAttendanceDrawer.vue'
import AnnotationEditor from '../components/minutes/AnnotationEditor.vue'
import MinuteComments from '../components/minutes/MinuteComments.vue'
import { markdownToHtml, htmlToMarkdown, isStoredHtml } from '../utils/markdownUtils'
import { buildPeopleIndex, buildPlaceIndex, makeDecorator } from '../utils/minuteAnnotations'
import { sectionIcon } from '../utils/minuteSections'
import { extractActionItems, toTaskDraft } from '../utils/minuteActionItems'
import { enhanceMinutesWithClaude } from '../utils/minutesEnhancer'
import { useMediaQuery } from '../composables/useMediaQuery'
import { useMentionPicker } from '../composables/useMentionPicker'
import { useLiveHighlights } from '../composables/useLiveHighlights'
import { useScrollLock } from '../composables/useScrollLock'

const route = useRoute()
const router = useRouter()
const { minutes, loading, removeMinute, updateMinuteInFirestore } = useMinutes()
const { members } = useMembers()
const { tasks, addTask } = useTasks()
const { canManage, myMember } = usePermissions()
const { user } = useAuth()
const isMobile = useMediaQuery('(max-width: 1023px)')

const canAddTasks = computed(() => canManage('tasks'))
const canEditMinute = computed(() => canManage('minutes'))
const mentions = useMentionPicker(members)

const showConfirmation = ref(false)
const showAttendeesDrawer = ref(false)
const showAgendaSheet = ref(false)
// Copy / revert / delete-item, folded out of the pinned header so the one
// button that matters there is the one that writes the minutes up.
const itemMenuOpen = ref(false)
const savingAttendance = ref(false)
const selectedAgendaIndex = ref(null) // null = summary, number = agenda item index
const newAgendaItem = ref('')
const showAddAgendaModal = ref(false)
const editingContentIndex = ref(null)
const editingContent = ref('')
const editingAgendaIndex = ref(null)
const editingAgendaName = ref('')
// Anything covering the page holds it still underneath. The attendees panel
// only covers it on a phone — on a wide screen it is a column beside the
// minute, and the page it sits next to should still scroll.
useScrollLock(() => showAddAgendaModal.value || showAgendaSheet.value || (isMobile.value && showAttendeesDrawer.value))

const isEnhancing = ref(false)
const isEnhancingOverall = ref(false)

// What /api/enhance is doing right now, so the page can show it rather than
// dimming a button for a minute and hoping nobody presses it again. `phase`
// is 'reading' while the model is still working the notes out and 'writing'
// once the document starts arriving; `text` is the draft so far.
const writing = ref({ active: false, phase: 'reading', text: '', subject: '' })

const startWriting = (subject) => {
  writing.value = { active: true, phase: 'reading', text: '', subject }
}

const onWritingEvent = (event) => {
  if (event.type === 'text') {
    writing.value = { ...writing.value, phase: 'writing', text: event.text }
  }
}

const stopWriting = () => {
  writing.value = { active: false, phase: 'reading', text: '', subject: '' }
}
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

// Sixteen call sites used this and none of them defined it, so every one threw
// a ReferenceError instead of showing a message — including the ones inside a
// catch, which then swallowed the error they were reporting. Reverting notes
// looked like it did nothing at all.
let toastTimer = null
const showToastNotification = (message, type = 'success') => {
  toastMessage.value = message
  toastType.value = type
  showToast.value = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { showToast.value = false }, 3200)
}

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

const findMember = (memberId) =>
  memberId
    ? members.value?.find(
        (m) =>
          String(m.id) === String(memberId) || String(m.firestoreId) === String(memberId)
      )
    : null

/**
 * What the church calls someone: their nickname, or their first name. Used
 * everywhere a person is named on this page and in the write-up's attendance
 * line — a minute reading "Present: Joyce, Bro Dan, Tita Mercy" is how the
 * meeting actually referred to them.
 */
const getMemberName = (memberId) => {
  const member = findMember(memberId)
  return member ? getDisplayName(member) || getFullName(member).trim() : 'Unknown'
}

/** The name on the record, for the export — which leaves the app. */
const getMemberFullName = (memberId) => {
  const member = findMember(memberId)
  return member ? getFullName(member).trim() : 'Unknown'
}

const selectSummary = () => {
  selectedAgendaIndex.value = null
  showAgendaSheet.value = false
  // Scroll to the content section
  const contentElement = document.getElementById('agenda-content')
  if (contentElement) {
    contentElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

const selectAgendaItem = (index) => {
  selectedAgendaIndex.value = index
  showAgendaSheet.value = false
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
      text += `- ${getMemberFullName(id)}\n`
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
        if (item.assignee) text += `   Assigned to: ${getMemberFullName(item.assignee)}\n`
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

// The legacy `content` field, from before minutes had a structure. Always
// through the renderer: it used to be passed to v-html untouched whenever it
// had no "#" in it, which is most of them.
const processContent = (content) => (content ? renderMinute(content) : '')

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

/* ------------------------------------------------- reading the written page */

// Everyone on the roster, matched against however the minutes name them, so a
// task written "letter (joyce)" points at the same record as "Sis Joyce".
const peopleIndex = computed(() => buildPeopleIndex(members.value || []))

// Where the church meets, from its own records. Every minute's location is
// already loaded here, so this costs nothing; events are not subscribed to on
// this page and are deliberately not fetched for it.
const placeIndex = computed(() =>
  buildPlaceIndex(
    [minute.value?.location, ...minutes.value.map((record) => record.location)].filter(Boolean),
    peopleIndex.value
  )
)

/**
 * What a reader has corrected on this minute: words that are not names after
 * all, and words that are a particular person. Kept per minute rather than
 * church-wide — "Mark" is a name in the minute where Mark took a task and a
 * word in the one about marking the anniversary.
 */
const corrections = computed(() => ({
  dismissed: currentStructure.value.annotations?.dismissed || [],
  linked: currentStructure.value.annotations?.linked || {},
}))

const markOptions = () => ({
  index: peopleIndex.value,
  places: placeIndex.value,
  corrections: corrections.value,
})

const renderMinute = (markdown) =>
  markdownToHtml(markdown, {
    decorate: makeDecorator(markOptions()),
    headingIcon: sectionIcon,
  })

// Held in computeds rather than called from the template: the decorator walks
// every text run against the whole roster, and the page re-renders on every
// keystroke in the editor beside it.
const summaryHtml = computed(() =>
  currentStructure.value.overallSummary ? renderMinute(currentStructure.value.overallSummary) : ''
)

const agendaHtml = computed(() => {
  if (!currentAgendaItem.value) return ''
  const content = currentStructure.value.discussions?.[currentAgendaItem.value.index]
  return content ? renderMinute(content) : ''
})

/* ------------------------------------------------ correcting the highlights */

const activeMark = ref(null)

/**
 * Tapping a highlight opens what it was taken for, and the ways to disagree.
 * The page's own content is v-html, so the click is caught on the container
 * rather than bound per span.
 *
 * A tap no longer navigates straight to the member. It used to, and that made
 * the one thing a wrong highlight needs — being told it is wrong — reachable
 * only by going somewhere else first.
 */
const handleBodyClick = (event) => {
  const chip = event.target.closest?.('[data-mark]')
  if (!chip) return
  event.preventDefault()

  const rect = chip.getBoundingClientRect()
  activeMark.value = {
    kind: chip.getAttribute('data-mark'),
    surface: chip.getAttribute('data-surface') || '',
    text: chip.textContent || '',
    memberId: chip.getAttribute('data-member-id') || '',
    name: chip.getAttribute('data-name') || chip.getAttribute('title') || '',
    fullName: chip.getAttribute('title') || '',
    label: chip.getAttribute('title') || '',
    rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
  }
}

const saveAnnotations = async (next) => {
  if (!minute.value) return
  const structure = minute.value.structure || {
    agenda: [], discussions: {}, decisions: {}, actionItems: [],
  }
  try {
    await updateMinuteInFirestore(minute.value, {
      structure: { ...structure, annotations: { ...(structure.annotations || {}), ...next } },
    })
  } catch (error) {
    console.error('Error saving annotation:', error)
    showToastNotification('Could not save that correction.', 'error')
  }
}

const handleDismissMark = async ({ surface, kind }) => {
  activeMark.value = null
  if (!surface) return
  const dismissed = [...new Set([...corrections.value.dismissed, surface])]
  // A word ruled out is also no longer linked to anyone, or the correction
  // would win against the very rule that just removed it.
  const linked = { ...corrections.value.linked }
  delete linked[surface]
  await saveAnnotations({ dismissed, linked })
  showToastNotification(`"${surface}" is no longer marked as a ${kind === 'person' ? 'name' : kind}`)
  liveHighlights.refresh()
}

const handleLinkMark = async ({ surface, memberId }) => {
  activeMark.value = null
  if (!surface || !memberId) return
  await saveAnnotations({
    linked: { ...corrections.value.linked, [surface]: String(memberId) },
    dismissed: corrections.value.dismissed.filter((word) => word !== surface),
  })
  showToastNotification(`"${surface}" now points at ${getMemberName(memberId)}`)
  liveHighlights.refresh()
}

const handleOpenMember = (memberId) => {
  activeMark.value = null
  router.push(`/members/${memberId}`)
}

/**
 * Attendance, edited from the minute rather than only from the editor drawer
 * before the meeting — which is the one moment nobody knows who is coming.
 * Saved on each tap: a roster kept mid-meeting is edited in ones and twos as
 * people arrive, and a Save button would be pressed once and forgotten.
 */
const handleToggleAttendee = async (memberId) => {
  if (!minute.value || !canEditMinute.value) return
  const id = String(memberId)
  const current = (minute.value.attendees || []).map(String)
  const attendees = current.includes(id)
    ? current.filter((entry) => entry !== id)
    : [...current, id]

  savingAttendance.value = true
  try {
    await updateMinuteInFirestore(minute.value, { attendees })
  } catch (error) {
    console.error('Error saving attendance:', error)
    showToastNotification('Could not save that. Try again.', 'error')
  } finally {
    savingAttendance.value = false
  }
}

/* -------------------------------------------------------- who this is for */

// Every tag and ministry anyone on the roster carries. Both, because a church
// files "Council" as a ministry and "Ushers" as a tag and neither distinction
// means anything to the person taking attendance.
const rosterTags = computed(() => {
  const seen = new Map()
  for (const member of members.value || []) {
    for (const entry of [...(member.tags || []), ...(member.ministries || [])]) {
      const name = String(entry || '').trim()
      if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name)
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
})

/**
 * The group this meeting is for. Stored on the minute once chosen; until then
 * guessed from the title, because "Church Council Meeting" and a Council tag
 * are the same word and asking would be asking about something already known.
 */
const attendanceTag = computed(() => {
  const stored = minute.value?.attendanceTag
  if (stored !== undefined && stored !== null) return stored
  const title = String(minute.value?.title || '').toLowerCase()
  return rosterTags.value.find((tag) => title.includes(tag.toLowerCase())) || ''
})

const handleAttendanceTag = async (tag) => {
  if (!minute.value || !canEditMinute.value) return
  try {
    await updateMinuteInFirestore(minute.value, { attendanceTag: tag })
  } catch (error) {
    console.error('Error saving the attendance group:', error)
  }
}

/** Which agenda items have been typed into, for the drawer's dots. */
const writtenIndexes = computed(() =>
  (currentStructure.value.agenda || [])
    .map((_, index) => index)
    .filter((index) => String(currentStructure.value.discussions?.[index] || '').trim())
)

/* ---------------------------------------------- notes for the next rewrite */

/**
 * Comments are filed against the thing they are about: the whole meeting, or
 * one agenda item. Keyed by agenda index for items and 'overall' for the
 * summary, so an item's notes travel with the item's own write-up.
 */
const commentScope = computed(() =>
  showSummary.value ? 'overall' : String(currentAgendaItem.value?.index ?? '')
)

const allComments = computed(() => currentStructure.value.comments || {})
const scopedComments = computed(() => allComments.value[commentScope.value] || [])

// Whatever the reader had selected when they reached for the button, so a note
// can point at the sentence it is about.
const commentQuote = ref('')

const captureSelection = () => {
  const text = String(window.getSelection?.() || '').trim().replace(/\s+/g, ' ')
  // A stray caret click selects nothing; a whole section is not a quote.
  if (text.length > 2 && text.length < 200) commentQuote.value = text
}

const writeComments = async (next) => {
  if (!minute.value) return false
  const structure = minute.value.structure || {
    agenda: [], discussions: {}, decisions: {}, actionItems: [],
  }
  try {
    await updateMinuteInFirestore(minute.value, {
      structure: { ...structure, comments: { ...allComments.value, ...next } },
    })
    return true
  } catch (error) {
    console.error('Error saving note:', error)
    showToastNotification('Could not save that note.', 'error')
    return false
  }
}

const handleAddComment = async ({ text, quote }, done) => {
  const comment = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    quote: quote || '',
    authorName: meAs.value.name,
    createdAt: new Date().toISOString(),
    appliedAt: '',
  }
  const ok = await writeComments({
    [commentScope.value]: [...scopedComments.value, comment],
  })
  if (ok) showToastNotification('Saved — it will be applied on the next write-up')
  done?.(ok)
}

const handleRemoveComment = async (id) => {
  await writeComments({
    [commentScope.value]: scopedComments.value.filter((comment) => comment.id !== id),
  })
}

/** What goes to the endpoint: the outstanding ones, in the order written. */
const pendingComments = (scope) =>
  (allComments.value[scope] || [])
    .filter((comment) => !comment.appliedAt)
    .map((comment) => ({ text: comment.text, quote: comment.quote }))

/**
 * Marked applied rather than deleted, once the write-up they shaped is saved.
 * A correction is why the minute reads the way it does, and deleting it would
 * leave a page nobody can account for — and would quietly stop being applied
 * on the rewrite after next.
 */
const markCommentsApplied = (scope) => {
  const stamp = new Date().toISOString()
  return {
    ...allComments.value,
    [scope]: (allComments.value[scope] || []).map((comment) =>
      comment.appliedAt ? comment : { ...comment, appliedAt: stamp }
    ),
  }
}

/* ----------------------------------------------------------- action items */

// The source for the buttons is whichever page is open: the whole meeting's
// Action Items when the summary is showing, this item's when it is not.
const actionItemSource = computed(() =>
  showSummary.value
    ? currentStructure.value.overallSummary || ''
    : currentStructure.value.discussions?.[currentAgendaItem.value?.index] || ''
)

const actionItemDrafts = computed(() => {
  if (!minute.value) return []
  return extractActionItems(actionItemSource.value).map((item) =>
    toTaskDraft(item, {
      members: members.value || [],
      meetingDate: minute.value.date,
      minute: minute.value,
      agendaTitle: showSummary.value ? '' : currentAgendaItem.value?.title || '',
    })
  )
})

const savingTaskTitles = ref([])

// Who is recorded as having added the task, in the same shape the Tasks page
// writes it — a task filed from a minute should be indistinguishable from one
// typed into the list by hand.
const meAs = computed(() => ({
  uid: user.value?.uid || '',
  name: myMember.value
    ? getFullName(myMember.value).trim()
    : user.value?.displayName || user.value?.email || 'Someone',
}))

const addActionItem = async (draft) => {
  if (!canAddTasks.value || savingTaskTitles.value.includes(draft.title)) return false
  savingTaskTitles.value = [...savingTaskTitles.value, draft.title]
  try {
    // `timelineText` is what the minute said and belongs to the panel, not to
    // the task — the task carries the resolved date and the wording in details.
    const { timelineText, added, busy, ...task } = draft
    await addTask({ ...task, createdBy: meAs.value.uid, createdByName: meAs.value.name })
    return true
  } catch (error) {
    console.error('Error adding task from minutes:', error)
    showToastNotification('Could not add that to the To-do list.', 'error')
    return false
  } finally {
    savingTaskTitles.value = savingTaskTitles.value.filter((title) => title !== draft.title)
  }
}

const handleAddActionItem = async (draft) => {
  if (await addActionItem(draft)) showToastNotification(`Added "${draft.title}" to the To-do list`)
}

const handleAddAllActionItems = async (drafts) => {
  // One at a time. Each one sends a push to whoever it is for, and the list
  // arriving in the order it was minuted is worth more than the half second.
  let saved = 0
  for (const draft of drafts) {
    if (await addActionItem(draft)) saved += 1
  }
  if (saved) {
    showToastNotification(`Added ${saved} ${saved === 1 ? 'item' : 'items'} to the To-do list`)
  }
}

const editableContentRef = ref(null)

// Names, dates and places light up as they are typed, painted over the text
// rather than wrapped around it — see useLiveHighlights for why that matters
// on a phone. Where the browser is too old for it, nothing shows until the
// editor is closed, which is what happened before.
const isEditingNotes = computed(() => editingContentIndex.value !== null)
const liveHighlights = useLiveHighlights(editableContentRef, markOptions, isEditingNotes)

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
  // HTML while it is being typed into, Markdown the moment it is saved. The
  // editor is a contenteditable and has no other currency; the record has
  // exactly one, so that re-enhancing and the Action Items panel keep working
  // after someone fixes a typo.
  let content = ''
  if (discussion) {
    content = isStoredHtml(discussion) ? discussion : markdownToHtml(discussion)
  }
  // Set either way. Left over from the last item, an empty note would save
  // that item's text over itself the moment this one was blurred.
  editingContent.value = discussion

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
  // The div manages its own content while it is focused; this only keeps hold
  // of what to write. Converted back to Markdown here rather than on blur, so
  // a save triggered from anywhere — the mention picker, the enhance button —
  // gets the same thing.
  editingContent.value = htmlToMarkdown(event.target.innerHTML)
  mentions.refresh()
  liveHighlights.refresh()
}

/** Arrows and Enter belong to the "@" list while it is open. */
const handleContentKeydown = (event) => {
  if (mentions.handleKeydown(event)) event.preventDefault()
}

const handleChooseMention = (candidate) => {
  const editable = document.querySelector(`[data-editing-index="${editingContentIndex.value}"]`)
  if (mentions.choose(candidate) && editable) {
    editingContent.value = htmlToMarkdown(editable.innerHTML)
  }
}

// The picker's buttons hold focus with mousedown.prevent, so if focus really
// left the editor it was not the picker that took it — and the save should go
// ahead whether the list happened to be open or not. Deferred a tick so the
// check sees where focus settled.
const handleContentBlurGuarded = (index) => {
  setTimeout(() => {
    const editable = document.querySelector(`[data-editing-index="${index}"]`)
    if (editable && document.activeElement === editable) return
    mentions.close()
    handleContentBlur(index)
  }, 0)
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
    // Markdown, always — including for the older records that were saved as
    // HTML, which nobody wants pasted into a message as tags.
    const contentToCopy = isStoredHtml(rawContent) ? htmlToMarkdown(rawContent) : rawContent

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
  startWriting(agendaTitle || 'this item')

  try {
    // Sent as Markdown, not as flattened text. The old code ran the notes
    // through textContent first, which handed Claude one undifferentiated
    // paragraph — every heading, bullet and table the notes already had was
    // thrown away before the model that had to organise them ever saw it.
    const plainText = isStoredHtml(rawNotes) ? htmlToMarkdown(rawNotes) : rawNotes

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
    
    // Enhance the notes (returns markdown, streamed so the page can show it).
    // The notes for the rewrite go with it, so a correction made against the
    // last draft is applied to this one instead of being written over.
    const enhancedMarkdown = await enhanceMinutesWithClaude(
      agendaTitle,
      plainText,
      'agenda',
      {},
      onWritingEvent,
      pendingComments(String(index))
    )
    
    // Convert markdown to HTML for display
    const enhancedHtml = markdownToHtml(enhancedMarkdown)
    
    // Save markdown to Firestore (store as markdown, render as HTML)
    const newDiscussions = { ...currentStructure.discussions }
    newDiscussions[index] = enhancedMarkdown // Store markdown
    
    await updateMinuteInFirestore(minute.value, {
      structure: {
        ...currentStructure,
        discussions: newDiscussions,
        rawDiscussions: rawDiscussions, // Preserve original notes
        comments: markCommentsApplied(String(index)),
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
    showToastNotification('The minutes are written up')
  } catch (error) {
    console.error('Error enhancing minutes:', error)
    showToastNotification(error.message || 'Failed to enhance minutes. Please try again.', 'error')
  } finally {
    isEnhancing.value = false
    stopWriting()
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
        editableDiv.innerHTML = isStoredHtml(rawNotes) ? rawNotes : markdownToHtml(rawNotes)
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
        // Markdown either way, so the whole-meeting write-up is drawing
        // together items that already have their shape rather than re-reading
        // them out of a wall of text.
        const asMarkdown = isStoredHtml(discussion) ? htmlToMarkdown(discussion) : discussion
        allDiscussions.push(`**${agendaTitle}**:\n${asMarkdown}`)
      }
    })
    
    if (allDiscussions.length === 0) {
      showToastNotification('Please add notes to at least one agenda item before enhancing overall summary', 'error')
      isEnhancingOverall.value = false
      return
    }
    
    const combinedNotes = allDiscussions.join('\n\n')
    const meetingTitle = minute.value.title || 'Meeting'

    startWriting(
      `${allDiscussions.length} agenda ${allDiscussions.length === 1 ? 'item' : 'items'}`
    )

    // "meeting" mode draws the agenda items together rather than minuting one
    // of them; the endpoint used to have to infer that from the notes' shape.
    // The header details come from the minute itself — the notes never carry
    // the date, the place or who turned up.
    const enhancedMarkdown = await enhanceMinutesWithClaude(
      meetingTitle,
      combinedNotes,
      'meeting',
      {
        date: formatDate(minute.value.date),
        startTime: minute.value.startTime,
        endTime: minute.value.endTime,
        location: minute.value.location,
        present: (minute.value.attendees || []).map(getMemberName).filter((name) => name !== 'Unknown'),
      },
      onWritingEvent,
      pendingComments('overall')
    )

    if (!enhancedMarkdown || !enhancedMarkdown.trim()) {
      throw new Error('AI returned empty summary')
    }
    
    // Save to Firestore
    await updateMinuteInFirestore(minute.value, {
      structure: {
        ...structure,
        overallSummary: enhancedMarkdown, // Store markdown
        comments: markCommentsApplied('overall'),
      }
    })
    
    showToastNotification('The meeting summary is written up')
  } catch (error) {
    console.error('Error enhancing overall summary:', error)
    showToastNotification(`Could not write the summary: ${error.message || 'please try again.'}`, 'error')
  } finally {
    isEnhancingOverall.value = false
    stopWriting()
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
  <div class="flex flex-col h-full min-h-0">
    <!-- Header. On a focus route the layout supplies no padding and nothing
         sits above this, so it owns the gutter and the notch. -->
    <div class="shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-2 sm:px-4 lg:px-8 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div class="flex items-center gap-1.5 pb-2 sm:gap-3 sm:pb-3">
        <button
          @click="router.push('/minutes')"
          class="shrink-0 rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          aria-label="Back to minutes"
        >
          <ArrowLeft class="h-5 w-5" />
        </button>
        <div class="min-w-0 flex-1">
          <h1 class="truncate text-sm font-bold text-gray-900 sm:text-lg dark:text-white">
            {{ minute?.title || 'Meeting Minutes' }}
          </h1>
          <div
            class="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-gray-500 sm:text-xs dark:text-gray-400"
          >
            <span v-if="minute?.date" class="flex items-center gap-1">
              <Calendar class="h-3.5 w-3.5" />
              {{ formatDate(minute.date) }}
            </span>
            <span v-if="minute?.startTime" class="hidden items-center gap-1 sm:flex">
              <Clock class="h-3.5 w-3.5" />
              {{ minute.startTime }}{{ minute.endTime ? ` – ${minute.endTime}` : '' }}
            </span>
            <span v-if="minute?.location" class="hidden items-center gap-1 sm:flex">
              <MapPin class="h-3.5 w-3.5" />
              <span class="truncate">{{ minute.location }}</span>
            </span>
          </div>
        </div>

        <!-- One button on a phone. Attendance, export and delete were three
             more unlabelled icons up here; they are named rows in the drawer
             now, which is also where the agenda lives. -->
        <button
          v-if="minute"
          @click="showAgendaSheet = true"
          class="shrink-0 rounded-lg p-2 text-gray-600 hover:bg-gray-100 lg:hidden dark:text-gray-300 dark:hover:bg-gray-700"
          aria-label="Agenda and meeting actions"
        >
          <Menu class="h-5 w-5" />
        </button>

        <!-- The wide screen has room to keep them out, and a rail for the
             agenda, so it does not need the drawer. -->
        <div class="hidden shrink-0 items-center gap-1 lg:flex">
          <button
            @click="showAttendeesDrawer = true"
            class="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            :title="`${minute?.attendees?.length || 0} present`"
          >
            <Users class="h-4.5 w-4.5" />
            <span class="tabular-nums">{{ minute?.attendees?.length || 0 }}</span>
          </button>
          <button
            @click="exportToText"
            class="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            title="Export as text"
            aria-label="Export as text"
          >
            <Download class="h-4.5 w-4.5" />
          </button>
          <button
            @click="handleDelete"
            class="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            title="Delete these minutes"
            aria-label="Delete these minutes"
          >
            <Trash2 class="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <!-- Sidebar - Summary & Agenda (desktop only, see mobile agenda sheet below) -->
      <div v-if="minute" class="hidden lg:flex w-64 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-col shrink-0">
        <!-- Summary Section - Standalone -->
        <div class="p-3 border-b-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50">
          <button
            @click="selectSummary"
            :class="[
              'w-full text-left px-4 py-3 rounded-lg transition-all duration-200 font-semibold',
              showSummary
                ? 'bg-primary text-white shadow-md'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600'
            ]"
          >
            <div class="flex items-center gap-2">
              <FileText :class="['h-5 w-5', showSummary ? 'text-white' : 'text-primary']" />
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
              class="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-primary transition-colors"
              title="Add agenda item"
              aria-label="Add agenda item"
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
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 border border-transparent hover:border-gray-200 dark:hover:border-gray-600'
                  ]"
                >
                  <div class="flex items-start gap-2">
                    <span :class="[
                      'text-xs font-bold mt-0.5 shrink-0',
                      selectedAgendaIndex === index 
                        ? 'text-white/90' 
                        : 'text-gray-400 dark:text-gray-500 group-hover:text-primary'
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

      <!-- Main Content. A column, not a scroller: the section header stays put
           and only the document under it moves. A title and a "Write again"
           button that scroll away leave you halfway down a long minute with no
           way to tell what you are reading or to act on it. -->
      <!-- min-w-0 is load-bearing: a flex item defaults to min-width:auto, so
           an Action Items table wider than the phone stretched this column
           past the viewport and took the whole page sideways with it. Zero
           lets the column shrink, and the table scrolls inside its own box. -->
      <div class="flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-gray-800">
        <div v-if="loading" class="flex items-center justify-center h-full">
          <div class="text-center">
            <div class="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
              class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              Back to Minutes
            </button>
          </div>
        </div>
        <!-- The last thing on the page is a comment box or an action item, and
             with no bottom bar under it the home indicator would sit on top of
             them. -->
        <template v-else>
          <!-- Pinned: which part of the minute is open, and the one action
               that applies to it. Stays while the document scrolls. -->
          <div
            class="flex shrink-0 items-center gap-2 border-b border-gray-200 px-3 py-2 sm:px-6 sm:py-2.5 dark:border-gray-700"
          >
            <template v-if="showSummary">
              <h2 class="min-w-0 flex-1 truncate text-sm font-bold text-gray-900 sm:text-base dark:text-white">
                Summary
              </h2>
              <button
                v-if="canEditMinute"
                @click="enhanceOverallSummary"
                :disabled="isEnhancingOverall"
                class="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 sm:px-3 sm:py-2 sm:text-sm"
                :title="currentStructure.overallSummary ? 'Write the summary again from all agenda items' : 'Write the summary from all agenda items'"
              >
                <Loader2 v-if="isEnhancingOverall" class="h-4 w-4 animate-spin" />
                <Sparkles v-else class="h-4 w-4" />
                <span>{{ isEnhancingOverall ? 'Writing…' : currentStructure.overallSummary ? 'Write again' : 'Write it up' }}</span>
              </button>
            </template>

            <template v-else-if="currentAgendaItem">
              <input
                v-if="editingAgendaIndex === currentAgendaItem.index"
                v-model="editingAgendaName"
                @blur="handleAgendaNameBlur(currentAgendaItem.index)"
                @keyup.enter="handleAgendaNameBlur(currentAgendaItem.index)"
                @keyup.esc="editingAgendaIndex = null"
                class="min-w-0 flex-1 border-b-2 border-primary bg-transparent text-sm font-bold text-gray-900 focus:outline-none sm:text-base dark:text-white"
                autofocus
              />
              <h2
                v-else
                @dblclick="handleAgendaNameDblClick(currentAgendaItem.index)"
                class="min-w-0 flex-1 cursor-text truncate text-sm font-bold text-gray-900 transition-colors hover:text-primary sm:text-base dark:text-white"
                title="Double-click to rename"
              >
                <span class="text-gray-400 dark:text-gray-500">
                  {{ toRomanNumeral(currentAgendaItem.index + 1) }}.
                </span>
                {{ currentAgendaItem.title }}
              </h2>

              <button
                v-if="canEditMinute && currentStructure.discussions?.[currentAgendaItem.index]"
                @click="enhanceMinutes"
                :disabled="isEnhancing"
                class="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 sm:px-3 sm:py-2 sm:text-sm"
                title="Write these notes up as minutes"
              >
                <Loader2 v-if="isEnhancing" class="h-4 w-4 animate-spin" />
                <Sparkles v-else class="h-4 w-4" />
                <span>{{ isEnhancing ? 'Writing…' : 'Write up' }}</span>
              </button>

              <!-- Copy, revert and delete-item were three coloured buttons
                   competing with the one that matters. Folded into an overflow
                   so "Write up" is the only thing shouting. -->
              <button
                @click.stop="itemMenuOpen = !itemMenuOpen"
                class="relative shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                aria-label="More actions for this item"
                :aria-expanded="itemMenuOpen"
              >
                <MoreVertical class="h-4.5 w-4.5" />
              </button>
            </template>
          </div>

          <!-- The only scroller on the page. -->
          <div
            class="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-6 sm:py-4 pb-[max(1.5rem,calc(1rem+env(safe-area-inset-bottom)))]"
          >
          <!-- Overall Meeting Summary -->
          <div v-if="showSummary && minute.structure" id="agenda-content">
            <!-- While it is being written, the draft itself is what shows. -->
            <MinuteWritingPanel
              :active="writing.active"
              :phase="writing.phase"
              :text="writing.text"
              :subject="writing.subject"
            />

            <template v-if="!writing.active">
              <div
                v-if="currentStructure.overallSummary"
                class="minute-body p-3 sm:p-5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                @click="handleBodyClick"
                @mouseup="captureSelection"
                @touchend="captureSelection"
                v-html="summaryHtml"
              ></div>
              <div v-else class="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-5 text-center dark:border-gray-600 dark:bg-gray-700/50">
                <Sparkles class="mx-auto mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
                <p class="mb-1 text-sm font-medium text-gray-600 dark:text-gray-300">
                  No summary written yet
                </p>
                <p class="mx-auto max-w-md text-xs text-gray-400 dark:text-gray-500">
                  Draw every agenda item together into one set of minutes — attendance, what was
                  decided, the money, and who has to do what.
                </p>
              </div>

              <!-- Every commitment the meeting made, one button from the list
                   the church actually works off. -->
              <MinuteActionItems
                :items="actionItemDrafts"
                :tasks="tasks"
                :saving="savingTaskTitles"
                :can-edit="canAddTasks"
                @add="handleAddActionItem"
                @add-all="handleAddAllActionItems"
                @open-tasks="router.push('/tasks')"
              />

              <MinuteComments
                :comments="scopedComments"
                :can-edit="canEditMinute"
                :quote="commentQuote"
                scope="the meeting summary"
                @add="handleAddComment"
                @remove="handleRemoveComment"
                @clear-quote="commentQuote = ''"
              />
            </template>
          </div>
          
          <!-- Notepad-style Content for Agenda Items -->
          <div v-else-if="minute.structure && currentStructure.agenda && currentStructure.agenda.length > 0 && currentAgendaItem" id="agenda-content">
            <div v-if="currentAgendaItem" class="notepad-section">
              <!-- While it is being written, the draft itself is what shows. -->
              <MinuteWritingPanel
                :active="writing.active"
                :phase="writing.phase"
                :text="writing.text"
                :subject="writing.subject"
              />

              <!-- Editable Content Area -->
              <div
                v-if="!writing.active && editingContentIndex === currentAgendaItem.index"
                :data-editing-index="currentAgendaItem.index"
                ref="editableContentRef"
                contenteditable="true"
                @input="handleContentInput"
                @keydown="handleContentKeydown"
                @blur="handleContentBlurGuarded(currentAgendaItem.index)"
                class="minute-body min-h-50 p-3 sm:p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary text-gray-900 dark:text-white"
              ></div>
              <div
                v-else-if="!writing.active"
                @dblclick="handleContentClick(currentAgendaItem.index)"
                @click="handleBodyClick"
                @mouseup="captureSelection"
                @touchend="captureSelection"
                class="minute-body min-h-50 p-3 sm:p-4 border border-transparent hover:border-gray-300 dark:hover:border-gray-600 rounded-lg cursor-text text-gray-900 dark:text-white"
                :class="{
                  'bg-gray-50 dark:bg-gray-700/50': currentStructure.discussions?.[currentAgendaItem.index],
                  'text-gray-400 dark:text-gray-500 italic': !currentStructure.discussions?.[currentAgendaItem.index]
                }"
              >
                <div v-if="agendaHtml" v-html="agendaHtml"></div>
                <div v-else class="select-none">Click to add notes...</div>
              </div>

              <p
                v-if="editingContentIndex === currentAgendaItem.index"
                class="mt-2 text-xs text-gray-400 dark:text-gray-500"
              >
                Type <span class="font-semibold">@</span> to pull a name off the roster.
              </p>

              <!-- The item's own commitments, from the table above. -->
              <template v-if="editingContentIndex !== currentAgendaItem.index && !writing.active">
                <MinuteActionItems
                  :items="actionItemDrafts"
                  :tasks="tasks"
                  :saving="savingTaskTitles"
                  :can-edit="canAddTasks"
                  @add="handleAddActionItem"
                  @add-all="handleAddAllActionItems"
                  @open-tasks="router.push('/tasks')"
                />

                <MinuteComments
                  :comments="scopedComments"
                  :can-edit="canEditMinute"
                  :quote="commentQuote"
                  :scope="`&ldquo;${currentAgendaItem.title}&rdquo;`"
                  @add="handleAddComment"
                  @remove="handleRemoveComment"
                  @clear-quote="commentQuote = ''"
                />
              </template>
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
          <div v-else-if="minute.content">
            <div
              class="minute-body text-sm text-gray-700 dark:text-gray-300"
              @click="handleBodyClick"
              v-html="processContent(minute.content)"
            ></div>
          </div>

          <div v-else class="text-center py-12">
            <p class="text-sm text-gray-500 dark:text-gray-400 italic">No content recorded for this meeting.</p>
          </div>
          </div>
        </template>
      </div>

      <!-- Who was there — editable, and a side drawer on every size. It was
           read-only, so the one list the whole-meeting write-up depends on
           could only be set before the meeting started. -->
      <MinuteAttendanceDrawer
        :show="showAttendeesDrawer && Boolean(minute)"
        :members="members"
        :attendees="minute?.attendees || []"
        :can-edit="canEditMinute"
        :saving="savingAttendance"
        :tags="rosterTags"
        :tag="attendanceTag"
        @close="showAttendeesDrawer = false"
        @toggle="handleToggleAttendee"
        @update:tag="handleAttendanceTag"
      />

      <!-- Getting around the meeting on a phone. A side drawer rather than the
           bottom sheet this was: a dozen agenda items want height, and this
           puts the agenda where the desktop rail already is. -->
      <MinuteNavDrawer
        :show="showAgendaSheet && Boolean(minute)"
        :agenda="currentStructure.agenda || []"
        :selected-index="selectedAgendaIndex"
        :attendee-count="minute?.attendees?.length || 0"
        :can-edit="canEditMinute"
        :written="writtenIndexes"
        @close="showAgendaSheet = false"
        @select-summary="selectSummary"
        @select="selectAgendaItem"
        @add="showAgendaSheet = false; handleAddAgendaClick()"
        @attendance="showAgendaSheet = false; showAttendeesDrawer = true"
        @export="showAgendaSheet = false; exportToText()"
        @delete="showAgendaSheet = false; handleDelete()"
      />
    </div>

    <!-- Add Agenda Modal. The only overlay on this page that is not teleported
         out to the body, so it is also the only one a wheel over the backdrop
         could chain past into the page behind: overflow-hidden makes the
         backdrop a scroller of its own and overscroll-contain stops it
         handing the gesture on. -->
    <Transition name="modal">
      <div
        v-if="showAddAgendaModal"
        class="fixed inset-0 z-50 flex items-center justify-center overflow-hidden overscroll-contain bg-black/50 backdrop-blur-sm p-4"
        @click.self="closeAddAgendaModal"
      >
        <div
          class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full"
          @click.stop
        >
          <!-- Header -->
          <div class="shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
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
              class="w-full px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              autofocus
            />
          </div>

          <!-- Footer -->
          <div class="shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
            <button
              @click="closeAddAgendaModal"
              class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              @click="handleAddAgendaSubmit"
              :disabled="!newAgendaItem.trim()"
              class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- The agenda item's other actions -->
    <Teleport to="body">
      <div v-if="itemMenuOpen && currentAgendaItem" class="fixed inset-0 z-90" @click="itemMenuOpen = false">
        <div
          class="absolute right-3 top-28 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-600 dark:bg-gray-800"
          @click.stop
        >
          <button
            v-if="currentStructure.discussions?.[currentAgendaItem.index]"
            @click="itemMenuOpen = false; copyRawContent()"
            class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <Copy class="h-4 w-4 shrink-0 text-gray-400" />
            Copy as text
          </button>
          <button
            v-if="currentStructure.rawDiscussions?.[currentAgendaItem.index]"
            @click="itemMenuOpen = false; revertToOriginalNotes()"
            class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <RotateCcw class="h-4 w-4 shrink-0 text-gray-400" />
            Back to my notes
          </button>
          <button
            v-if="canEditMinute"
            @click="itemMenuOpen = false; handleDeleteAgendaItem(currentAgendaItem.index)"
            class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <Trash2 class="h-4 w-4 shrink-0" />
            Delete this item
          </button>
        </div>
      </div>
    </Teleport>

    <!-- Disagreeing with a highlight -->
    <AnnotationEditor
      :mark="activeMark"
      :members="members"
      :can-edit="canEditMinute"
      :is-mobile="isMobile"
      @close="activeMark = null"
      @open-member="handleOpenMember"
      @link="handleLinkMark"
      @dismiss="handleDismissMark"
    />

    <!-- "@" in the notes editor -->
    <MentionPicker
      :open="mentions.open.value"
      :matches="mentions.matches.value"
      :active-index="mentions.activeIndex.value"
      :anchor="mentions.anchor.value"
      @choose="handleChooseMention"
      @hover="mentions.activeIndex.value = $event"
    />

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
/* .minute-body lives in src/style.css — three components render the same
 * document and it has to look identical in all of them. */

.attendees-drawer {
  transition: max-width 0.3s ease-out, opacity 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}

.drawer-enter-from.attendees-drawer,
.drawer-leave-to.attendees-drawer {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
  margin-left: 0;
  margin-right: 0;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-sheet-enter-active,
.modal-sheet-leave-active {
  transition: opacity 0.25s ease;
}

.modal-sheet-enter-active > div:last-child,
.modal-sheet-leave-active > div:last-child {
  transition: transform 0.25s ease;
}

.modal-sheet-enter-from,
.modal-sheet-leave-to {
  opacity: 0;
}

.modal-sheet-enter-from > div:last-child,
.modal-sheet-leave-to > div:last-child {
  transform: translateY(100%);
}

/* Typography for the editor came from a second, slightly different set of
 * rules here — bigger headings, tighter lists — so the page changed shape the
 * moment you clicked into it. .minute-body above covers both now. */
.notepad-section [contenteditable] {
  outline: none;
}
</style>
