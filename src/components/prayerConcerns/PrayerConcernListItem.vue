<script setup>
import { Heart, User, Calendar, AlertCircle, CheckCircle2, Clock, ArrowUpCircle, Trash2 } from 'lucide-vue-next'

const props = defineProps({
  concern: {
    type: Object,
    required: true
  },
  selected: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['click', 'delete'])

const handleDelete = (e) => {
  e.stopPropagation()
  emit('delete', props.concern)
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

const getStatusColor = (status) => {
  switch (status) {
    case 'answered':
      return 'bg-green-500 text-white'
    case 'ongoing':
      return 'bg-blue-500 text-white'
    case 'active':
    default:
      return 'bg-yellow-500 text-white'
  }
}

const getStatusIcon = (status) => {
  switch (status) {
    case 'answered':
      return CheckCircle2
    case 'ongoing':
      return Clock
    case 'active':
    default:
      return Heart
  }
}

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'urgent':
      return 'bg-red-500 text-white'
    case 'high':
      return 'bg-orange-500 text-white'
    case 'normal':
    default:
      return 'bg-gray-500 text-white'
  }
}

const getPriorityIcon = (priority) => {
  if (priority === 'urgent' || priority === 'high') {
    return ArrowUpCircle
  }
  return null
}
</script>

<template>
  <div 
    @click="emit('click', concern)"
    :class="[
      'p-4 transition-all cursor-pointer border-l-4',
      selected
        ? 'bg-[#01779b]/10 dark:bg-[#01779b]/20 border-[#01779b]'
        : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-transparent'
    ]"
  >
    <div class="flex items-start gap-4">
      <div class="flex-shrink-0 h-12 w-12 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
        <Heart class="h-6 w-6 text-red-600 dark:text-red-400" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap mb-1">
          <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
            {{ concern.title || 'Untitled Prayer Concern' }}
          </p>
          <span 
            v-if="concern.priority && (concern.priority === 'urgent' || concern.priority === 'high')"
            :class="[
              'px-2 py-0.5 text-xs rounded-full capitalize flex items-center gap-1',
              getPriorityColor(concern.priority)
            ]"
          >
            <ArrowUpCircle v-if="getPriorityIcon(concern.priority)" class="h-3 w-3" />
            {{ concern.priority }}
          </span>
          <span 
            :class="[
              'px-2 py-0.5 text-xs rounded-full capitalize flex items-center gap-1',
              getStatusColor(concern.status)
            ]"
          >
            <component :is="getStatusIcon(concern.status)" class="h-3 w-3" />
            {{ concern.status }}
          </span>
        </div>
        <p v-if="concern.description" class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
          {{ concern.description }}
        </p>
        <div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span v-if="concern.memberName" class="flex items-center gap-1">
            <User class="h-3.5 w-3.5" />
            {{ concern.memberName }}
          </span>
          <span v-if="concern.date" class="flex items-center gap-1">
            <Calendar class="h-3.5 w-3.5" />
            {{ formatDate(concern.date) }}
          </span>
        </div>
      </div>
      <button
        @click="handleDelete"
        class="flex-shrink-0 p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        title="Delete prayer concern"
      >
        <Trash2 class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>

