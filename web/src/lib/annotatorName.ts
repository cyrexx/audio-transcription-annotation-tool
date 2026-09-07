import { ref, watch } from 'vue'

const KEY = 'annotatorName'
const name = ref(localStorage.getItem(KEY) ?? '')
watch(name, (value) => localStorage.setItem(KEY, value))

/** The brief wants an annotator column but no accounts, so the name is typed once and kept locally. */
export function useAnnotatorName() {
  return name
}
