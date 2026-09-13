import { computed, onMounted, onUnmounted, ref } from 'vue'
import { subscribeToCustomTags } from '../api/tagsService'
import { useMinistries } from './useMinistries'

// The pictures ministries and tags are shown with, looked up by name.
//
// A member document stores ministries and tags as plain strings, so a chip on
// a profile knows only "Usher". This is the one place that turns that string
// into the icon or photograph Settings gave it. Ministries already have a
// shared listener; tags get one here, shared the same way, so a page of
// chips opens a single subscription rather than one per chip.

const tagRecords = ref([])
let unsubscribeTags = null
let tagSubscribers = 0

const key = (name) => String(name || '').trim().toLowerCase()

const toMark = (record) =>
  record && (record.icon || record.imageUrl)
    ? { icon: record.icon || '', imageUrl: record.imageUrl || '' }
    : null

export function useLabelMarks() {
  const { ministries } = useMinistries()

  onMounted(() => {
    tagSubscribers += 1
    if (unsubscribeTags) return
    unsubscribeTags = subscribeToCustomTags((tags) => {
      tagRecords.value = tags
    })
  })

  onUnmounted(() => {
    tagSubscribers -= 1
    if (tagSubscribers <= 0 && unsubscribeTags) {
      unsubscribeTags()
      unsubscribeTags = null
      tagSubscribers = 0
    }
  })

  const ministryMarks = computed(
    () => new Map(ministries.value.map((m) => [key(m.name), toMark(m)]))
  )
  const tagMarks = computed(() => new Map(tagRecords.value.map((t) => [key(t.name), toMark(t)])))

  /** `{ icon, imageUrl }` for a ministry's name, or null when it has none. */
  const ministryMark = (name) => ministryMarks.value.get(key(name)) || null

  /** The same for a tag. */
  const tagMark = (name) => tagMarks.value.get(key(name)) || null

  return { ministryMark, tagMark, tagRecords }
}
