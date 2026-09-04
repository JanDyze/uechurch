<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { subscribeToCustomTags } from '../../api/tagsService'
import { mergeTagSources } from '../../utils/memberUtils'
import { membersInAudience, audienceLabel } from '../../utils/audience'

// Who a gathering is for, picked from the member tags the church already uses.
// The number underneath is the point: it is counted off the roster as tags are
// tapped, so nobody has to estimate a turnout they cannot know.
//
// Two rows, because the useful audience is often stated the other way round. A
// members' meeting is not a list of tags — it is everyone except the kids, and
// spelling that out as a list of every other tag would go stale the moment a
// new one is added.

const props = defineProps({
  /** Selected tag names. Empty means everyone — see utils/audience.js. */
  modelValue: {
    type: Array,
    default: () => [],
  },
  /** Tags left out, subtracted after the ones above are gathered. */
  exclude: {
    type: Array,
    default: () => [],
  },
  members: {
    type: Array,
    default: () => [],
  },
  label: {
    type: String,
    default: "Who's expected",
  },
  /** So the block can wear whichever form's label style surrounds it. */
  labelClass: {
    type: String,
    default: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1',
  },
})

const emit = defineEmits(['update:modelValue', 'update:exclude'])

// Tags registered in Settings, which may not be on anyone yet.
const customTags = ref([])
let unsubscribe = null

onMounted(() => {
  unsubscribe = subscribeToCustomTags((tags) => {
    customTags.value = tags.map((t) => t.name)
  })
})

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
})

// The same list the member form offers: every tag someone is actually
// carrying, plus the registered ones nobody wears yet. Built from both so a
// tag typed onto one member is still selectable here.
const tagOptions = computed(() => {
  const onMembers = new Set()
  ;(props.members || []).forEach((member) => {
    ;(member?.tags || []).forEach((tag) => tag && onMembers.add(tag))
  })
  return mergeTagSources([...onMembers], customTags.value)
})

const selected = computed(() => props.modelValue || [])
const excluded = computed(() => props.exclude || [])

const holds = (list, tag) =>
  list.some((t) => String(t).toLowerCase() === tag.toLowerCase())
const without = (list, tag) =>
  list.filter((t) => String(t).toLowerCase() !== tag.toLowerCase())

const isSelected = (tag) => holds(selected.value, tag)
const isExcluded = (tag) => holds(excluded.value, tag)

const toggle = (tag) => {
  emit('update:modelValue', isSelected(tag) ? without(selected.value, tag) : [...selected.value, tag])
  // Including something it was excluding is a contradiction, so the exclusion
  // gives way rather than silently zeroing the count.
  if (isExcluded(tag)) emit('update:exclude', without(excluded.value, tag))
}

const toggleExcluded = (tag) => {
  emit('update:exclude', isExcluded(tag) ? without(excluded.value, tag) : [...excluded.value, tag])
  if (isSelected(tag)) emit('update:modelValue', without(selected.value, tag))
}

const chooseEveryone = () => emit('update:modelValue', [])

const rosterSize = computed(() => props.members?.length || 0)
const expected = computed(
  () => membersInAudience(props.members, selected.value, excluded.value).length
)
const countFor = (tag) => membersInAudience(props.members, [tag]).length

// Hidden until asked for, so the common case — a service everyone is welcome
// at — stays two lines rather than four.
const showExcept = ref(false)
const exceptOpen = computed(() => showExcept.value || excluded.value.length > 0)

const summary = computed(() => audienceLabel(selected.value, excluded.value))

// Two people can hold both tags, so the total is not the sum of the chips.
// Saying so costs one line and saves an admin doubting the number.
const overlaps = computed(
  () =>
    selected.value.length > 1 &&
    !excluded.value.length &&
    expected.value < selected.value.reduce((sum, tag) => sum + countFor(tag), 0)
)
</script>

<template>
  <div>
    <label :class="labelClass">
      {{ label }}
    </label>
    <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
      Pick the tags this is for. The expected count is read off the roster, so it
      keeps up as people are tagged.
    </p>

    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        @click="chooseEveryone"
        :aria-pressed="selected.length === 0"
        :class="[
          'px-3 py-1.5 text-xs font-medium rounded-full transition-all',
          selected.length === 0
            ? 'bg-primary dark:bg-primary-light text-white shadow-sm'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600',
        ]"
      >
        Everyone
        <span class="ml-1 tabular-nums opacity-70">{{ rosterSize }}</span>
      </button>

      <button
        v-for="tag in tagOptions"
        :key="tag"
        type="button"
        @click="toggle(tag)"
        :aria-pressed="isSelected(tag)"
        :class="[
          'px-3 py-1.5 text-xs font-medium rounded-full transition-all',
          isSelected(tag)
            ? 'bg-primary dark:bg-primary-light text-white shadow-sm'
            : isExcluded(tag)
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 line-through dark:text-gray-500'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600',
        ]"
      >
        {{ tag }}
        <span class="ml-1 tabular-nums opacity-70">{{ countFor(tag) }}</span>
      </button>
    </div>

    <p
      v-if="!tagOptions.length"
      class="mt-2 text-xs text-gray-400 dark:text-gray-500 italic"
    >
      No tags yet — add one from the Tags button on the People page, then tag who
      belongs to it.
    </p>

    <!-- Except -->
    <button
      v-if="tagOptions.length && !exceptOpen"
      type="button"
      @click="showExcept = true"
      class="mt-2 text-xs font-medium text-primary dark:text-primary-light"
    >
      Leave someone out…
    </button>

    <div v-else-if="tagOptions.length" class="mt-3">
      <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
        Except
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="tag in tagOptions"
          :key="`except-${tag}`"
          type="button"
          @click="toggleExcluded(tag)"
          :aria-pressed="isExcluded(tag)"
          :class="[
            'px-3 py-1.5 text-xs font-medium rounded-full transition-all',
            isExcluded(tag)
              ? 'bg-red-500 text-white shadow-sm dark:bg-red-500/80'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600',
          ]"
        >
          {{ tag }}
          <span class="ml-1 tabular-nums opacity-70">{{ countFor(tag) }}</span>
        </button>
      </div>
    </div>

    <p class="mt-3 text-sm text-gray-700 dark:text-gray-300">
      <span class="font-semibold tabular-nums text-primary dark:text-primary-light">
        {{ expected }}
      </span>
      {{ expected === 1 ? 'person' : 'people' }} expected
      <span class="text-gray-500 dark:text-gray-400">· {{ summary }}</span>
    </p>
    <p v-if="overlaps" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
      Someone in two of these is only counted once.
    </p>
  </div>
</template>
