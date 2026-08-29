import { ref, computed } from 'vue'
import { SG_LABELS, SG_LANGUAGES, sgLabel } from '../data/sgFormLabels'

const STORAGE_KEY = 'uec.sg.language'

// Module-level so every part of the form — drawer, printable sheet, export —
// reads the same toggle (same shared-state pattern as useToast).
const readStored = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return SG_LABELS[stored] ? stored : 'en'
  } catch {
    return 'en'
  }
}

const lang = ref(readStored())

const persist = (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Private mode / blocked storage: the toggle still works for this session.
  }
}

export function useSgLanguage() {
  const setLang = (value) => {
    if (!SG_LABELS[value]) return
    lang.value = value
    persist(value)
  }

  const toggle = () => setLang(lang.value === 'en' ? 'tl' : 'en')

  const t = (key) => sgLabel(lang.value, key)

  const weekdayName = (index) => t('weekdays')[index] ?? ''

  return {
    lang,
    languages: SG_LANGUAGES,
    isTagalog: computed(() => lang.value === 'tl'),
    setLang,
    toggle,
    t,
    weekdayName,
  }
}
