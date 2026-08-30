<script setup>
import { computed, ref } from 'vue'
import { Search, Check } from '../../icons'
import { getFullName } from '../../utils/memberUtils'
import MemberAvatar from '../members/MemberAvatar.vue'
import { memberKey } from '../../utils/sgUtils'

const props = defineProps({
  members: { type: Array, default: () => [] },
  // Selected member ids (strings). Compared loosely, matching the rest of the app.
  modelValue: { type: Array, default: () => [] },
  emptyLabel: { type: String, default: 'No members found.' },
  searchLabel: { type: String, default: 'Search' },
})

const emit = defineEmits(['update:modelValue'])

const searchQuery = ref('')

const filteredMembers = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const list = [...props.members].sort((a, b) => getFullName(a).localeCompare(getFullName(b)))
  if (!query) return list
  return list.filter((member) => {
    const haystack = `${getFullName(member)} ${member.nickname || ''}`.toLowerCase()
    return haystack.includes(query)
  })
})

const isSelected = (id) => props.modelValue.some((selected) => String(selected) === String(id))

const toggle = (id) => {
  const next = isSelected(id)
    ? props.modelValue.filter((selected) => String(selected) !== String(id))
    : [...props.modelValue, String(id)]
  emit('update:modelValue', next)
}

// Bulk actions apply to what is currently shown, so searching for a surname
// and tapping "Select shown" adds just that family.
const selectShown = () => {
  const next = [...props.modelValue]
  filteredMembers.value.forEach((member) => {
    const id = memberKey(member)
    if (!next.some((selected) => String(selected) === id)) next.push(id)
  })
  emit('update:modelValue', next)
}

const clearShown = () => {
  const shown = new Set(filteredMembers.value.map((member) => memberKey(member)))
  emit(
    'update:modelValue',
    props.modelValue.filter((selected) => !shown.has(String(selected)))
  )
}
</script>

<template>
  <div class="flex flex-col min-h-0">
    <div class="flex items-center gap-2 mb-2">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          v-model="searchQuery"
          type="search"
          :placeholder="searchLabel"
          class="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>
    </div>

    <div class="flex items-center gap-2 mb-2 text-xs">
      <button
        type="button"
        @click="selectShown"
        class="px-2.5 py-1 rounded-md bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition-colors"
      >
        Select shown
      </button>
      <button
        type="button"
        @click="clearShown"
        class="px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
      >
        Clear shown
      </button>
      <span class="ml-auto text-gray-500 dark:text-gray-400 font-medium">
        {{ modelValue.length }} selected
      </span>
    </div>

    <div
      class="flex-1 min-h-0 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700"
    >
      <p
        v-if="filteredMembers.length === 0"
        class="p-4 text-sm text-center text-gray-500 dark:text-gray-400"
      >
        {{ emptyLabel }}
      </p>
      <button
        v-for="member in filteredMembers"
        :key="memberKey(member)"
        type="button"
        @click="toggle(memberKey(member))"
        class="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <MemberAvatar :member="member" size="h-9 w-9" />
        <span class="flex-1 min-w-0">
          <span class="block text-sm font-medium text-gray-900 dark:text-white truncate">
            {{ getFullName(member) }}
          </span>
          <span
            v-if="member.nickname"
            class="block text-xs text-gray-500 dark:text-gray-400 truncate"
          >
            {{ member.nickname }}
          </span>
        </span>
        <span
          :class="[
            'h-6 w-6 shrink-0 rounded-md border flex items-center justify-center transition-colors',
            isSelected(memberKey(member))
              ? 'bg-primary border-primary text-white'
              : 'border-gray-300 dark:border-gray-600',
          ]"
        >
          <Check v-if="isSelected(memberKey(member))" class="h-4 w-4" />
        </span>
      </button>
    </div>
  </div>
</template>
