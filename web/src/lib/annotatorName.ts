import { ref, watch } from 'vue'

const KEY = 'annotatorName'

// Site data can be blocked or unavailable; the name is a convenience, so fall back to empty.
function read(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

const name = ref(read())
watch(name, (value) => {
  try {
    localStorage.setItem(KEY, value)
  } catch {
    // not persisted this session
  }
})

/** The brief wants an annotator column but no accounts, so the name is typed once and kept locally. */
export function useAnnotatorName() {
  return name
}
