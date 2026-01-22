<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { X, Clock, MapPin, Users, Calendar, Edit2, Trash2, Download, FileText, ExternalLink } from 'lucide-vue-next'
import { useMembers } from '../../composables/useMembers'
import { markdownToHtml } from '../../utils/markdownUtils'

const router = useRouter()

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  minute: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:show', 'edit', 'delete', 'export'])

const { members } = useMembers()

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

const getMemberName = (memberId) => {
  if (!memberId) return 'Unknown'
  const member = members.value.find(m => 
    String(m.id) === String(memberId) || 
    String(m.firestoreId) === String(memberId) ||
    m.id === memberId || 
    m.firestoreId === memberId
  )
  return member ? `${member.firstName || ''} ${member.lastName || ''}`.trim() : 'Unknown'
}

const processContent = (content) => {
  if (!content) return ''
  // If content contains markdown syntax, convert it
  if (content.includes('# ') || content.includes('## ') || content.includes('### ')) {
    return markdownToHtml(content)
  }
  return content
}

const exportToText = () => {
  if (!props.minute) return
  
  // Create a temporary div to extract text from HTML
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = props.minute.content || ''
  const textContent = tempDiv.textContent || tempDiv.innerText || ''
  
  let text = `MEETING MINUTES\n`
  text += `================\n\n`
  text += `Title: ${props.minute.title}\n`
  text += `Date: ${formatDate(props.minute.date)}\n`
  if (props.minute.startTime) {
    text += `Time: ${props.minute.startTime}`
    if (props.minute.endTime) text += ` - ${props.minute.endTime}`
    text += `\n`
  }
  if (props.minute.location) text += `Location: ${props.minute.location}\n`
  text += `\n`
  
  if (props.minute.attendees && props.minute.attendees.length > 0) {
    text += `ATTENDEES:\n`
    props.minute.attendees.forEach(id => {
      text += `- ${getMemberName(id)}\n`
    })
    text += `\n`
  }
  
  text += `\n${textContent}\n`
  
  // Create and download file
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.minute.title.replace(/[^a-z0-9]/gi, '_')}_${props.minute.date}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
</script>

<template>
  <Transition name="drawer">
    <div
      v-if="show && minute"
      class="minute-details-drawer border-l-4 border-[#01779b] bg-gray-50 dark:bg-gray-900 max-w-4xl w-[42rem] h-full flex flex-col flex-shrink-0 shadow-2xl shadow-[#01779b]/20"
    >
      <!-- Header -->
      <div class="flex-shrink-0 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Meeting Minutes</h3>
        <div class="flex items-center gap-2">
          <button
            @click="exportToText"
            class="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Export to text"
          >
            <Download class="h-5 w-5" />
          </button>
          <button
            @click="$emit('edit')"
            class="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Edit"
          >
            <Edit2 class="h-5 w-5" />
          </button>
          <button
            @click="$emit('update:show', false)"
            class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X class="h-5 w-5" />
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto min-h-0 p-6">
        <div class="space-y-6">
          <!-- Title -->
          <div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">{{ minute.title }}</h2>
            <div class="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span class="flex items-center gap-2">
                <Calendar class="h-4 w-4" />
                {{ formatDate(minute.date) }}
              </span>
              <span v-if="minute.startTime" class="flex items-center gap-2">
                <Clock class="h-4 w-4" />
                {{ minute.startTime }}<span v-if="minute.endTime"> - {{ minute.endTime }}</span>
              </span>
              <span v-if="minute.location" class="flex items-center gap-2">
                <MapPin class="h-4 w-4" />
                {{ minute.location }}
              </span>
            </div>
          </div>

          <!-- Attendees -->
          <div v-if="minute.attendees && minute.attendees.length > 0">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <Users class="h-4 w-4" />
              Attendees ({{ minute.attendees.length }})
            </h3>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="attendeeId in minute.attendees"
                :key="attendeeId"
                class="px-3 py-1 bg-[#01779b]/10 dark:bg-[#01779b]/20 text-[#01779b] rounded-full text-sm"
              >
                {{ getMemberName(attendeeId) }}
              </span>
            </div>
          </div>


          <!-- Structured Content Preview -->
          <div v-if="minute.structure">
            <div v-if="minute.structure.agenda && minute.structure.agenda.length > 0" class="mb-4">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">Agenda ({{ minute.structure.agenda.length }} items)</h3>
              <ul class="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li v-for="(item, index) in minute.structure.agenda.slice(0, 3)" :key="index">
                  {{ item }}
                </li>
                <li v-if="minute.structure.agenda.length > 3" class="text-gray-500 dark:text-gray-500">
                  ... and {{ minute.structure.agenda.length - 3 }} more
                </li>
              </ul>
            </div>
            <div v-if="minute.structure.actionItems && minute.structure.actionItems.length > 0" class="mb-4">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">Action Items ({{ minute.structure.actionItems.length }})</h3>
              <div class="space-y-1">
                <div
                  v-for="(item, index) in minute.structure.actionItems.slice(0, 2)"
                  :key="index"
                  class="text-sm text-gray-600 dark:text-gray-400"
                >
                  • {{ item.task }}
                </div>
                <div v-if="minute.structure.actionItems.length > 2" class="text-sm text-gray-500 dark:text-gray-500">
                  ... and {{ minute.structure.actionItems.length - 2 }} more
                </div>
              </div>
            </div>
          </div>

          <!-- Legacy Content -->
          <div v-else-if="minute.content" class="prose prose-sm dark:prose-invert max-w-none">
            <div class="text-sm text-gray-700 dark:text-gray-300 line-clamp-6" v-html="processContent(minute.content)"></div>
          </div>
          <div v-else class="text-sm text-gray-500 dark:text-gray-400 italic">
            No content recorded for this meeting.
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex-shrink-0 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center gap-3">
        <button
          @click="router.push(`/minutes/${minute.id || minute.firestoreId}`)"
          class="px-4 py-2 bg-[#01779b] text-white rounded-lg hover:bg-[#015a77] transition-colors flex items-center gap-2"
        >
          <ExternalLink class="h-4 w-4" />
          View Full Details
        </button>
        <button
          @click="$emit('delete')"
          class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
        >
          <Trash2 class="h-4 w-4" />
          Delete
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.minute-details-drawer {
  transition: max-width 0.3s ease-out, opacity 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}

.drawer-enter-from.minute-details-drawer,
.drawer-leave-to.minute-details-drawer {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
}
</style>

