<script setup lang="ts">
import {
  MAX_AUTO_REJECT_SEC,
  SPAN_TYPES,
  tokenize,
  type AnnotationUpdate,
  type DistanceEstimate,
  type ItemDetail,
  type SpanInput,
} from 'shared'
import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import AudioPlayer from '../components/AudioPlayer.vue'
import ConditionsPanel from '../components/ConditionsPanel.vue'
import ShortcutHelp from '../components/ShortcutHelp.vue'
import SpanForm from '../components/SpanForm.vue'
import SpanList from '../components/SpanList.vue'
import TranscriptEditor from '../components/TranscriptEditor.vue'
import { useAnnotatorName } from '../lib/annotatorName.ts'
import { api } from '../lib/api.ts'
import { STATUS_LABELS } from '../lib/format.ts'
import { matchShortcut, matchSpanType, JUMP_FAR_SEC, JUMP_SEC } from '../lib/shortcuts.ts'
import { shiftSpans } from '../lib/spanShift.ts'
import { innermostSpanAt, type EditorSpan } from '../lib/spans.ts'
import { estimateTokenTime } from '../lib/timestamps.ts'

const props = defineProps<{ id: string }>()

const AUTOSAVE_MS = 800

const item = ref<ItemDetail | null>(null)
const loadError = ref('')
/** Failures of pair, unpair and paste; shown inline, the page stays. */
const actionError = ref('')
const text = ref('')
const spans = ref<EditorSpan[]>([])
const speechRateOverride = ref<number | null>(null)
const distanceOverride = ref<DistanceEstimate | null>(null)
const mode = ref<'edit' | 'annotate'>('annotate')
const selection = ref<{ start: number; end: number } | null>(null)
const activeSpanId = ref<string | null>(null)
/** 'idle' until the first change of this visit, so a freshly loaded page shows no status. */
const saveState = ref<'idle' | 'saved' | 'dirty' | 'saving' | 'error'>('idle')
const saveError = ref('')
const pasteText = ref('')
const player = useTemplateRef<InstanceType<typeof AudioPlayer>>('player')
const spanForm = useTemplateRef<InstanceType<typeof SpanForm>>('spanForm')
const annotator = useAnnotatorName()

const tokens = computed(() => tokenize(text.value))
const editable = computed(
  () => item.value?.status !== 'AUTO_REJECTED' && item.value?.transcript != null,
)
const activeSpan = computed(() => spans.value.find((s) => s.id === activeSpanId.value) ?? null)
const formSelection = computed(() =>
  activeSpan.value ? { start: activeSpan.value.start, end: activeSpan.value.end } : selection.value,
)
const selectionText = computed(() =>
  formSelection.value
    ? tokens.value
        .slice(formSelection.value.start, formSelection.value.end)
        .map((t) => t.text)
        .join(' ')
    : '',
)

// Loading -------------------------------------------------------------------------------

async function load() {
  try {
    const detail = await api.getItem(props.id)
    // Textareas normalise CRLF to LF; do the same so token offsets and the textarea agree.
    text.value = (detail.correctedText ?? '').replace(/\r\n?/g, '\n')
    spans.value = detail.spans.map((s) => ({ ...s }))
    speechRateOverride.value = detail.speechRateWpmOverride
    distanceOverride.value = detail.distanceOverride
    item.value = detail
    clearSelection()
    lastSaved = serialized.value
    saveState.value = 'idle'
  } catch (e) {
    loadError.value = (e as Error).message
  }
}

// Saving --------------------------------------------------------------------------------

const update = computed<AnnotationUpdate>(() => ({
  correctedText: text.value,
  spans: spans.value.map(({ id: _id, ...span }) => span),
  speechRateWpmOverride: speechRateOverride.value,
  distanceOverride: distanceOverride.value,
  annotator: annotator.value.trim() || null,
}))
const serialized = computed(() => JSON.stringify(update.value))
let lastSaved = ''
let timer: ReturnType<typeof setTimeout> | undefined

watch(serialized, (now) => {
  if (!editable.value || now === lastSaved) return
  saveState.value = 'dirty'
  clearTimeout(timer)
  timer = setTimeout(() => void save(), AUTOSAVE_MS)
})

async function save(status?: 'IN_PROGRESS' | 'DONE') {
  if (!item.value || !editable.value) return
  clearTimeout(timer)
  const snapshot = serialized.value
  saveState.value = 'saving'
  try {
    const saved = await api.saveAnnotation(
      props.id,
      status ? { ...update.value, status } : update.value,
    )
    item.value = { ...item.value, status: saved.status, annotator: saved.annotator }
    lastSaved = snapshot
    if (serialized.value === snapshot) {
      saveState.value = 'saved'
    } else {
      // Edits arrived while the request was in flight; they are not saved yet.
      saveState.value = 'dirty'
      timer = setTimeout(() => void save(), AUTOSAVE_MS)
    }
  } catch (e) {
    // Stays visible in the header; the next change or Ctrl+S saves again.
    saveState.value = 'error'
    saveError.value = (e as Error).message
  }
}

/** The browser shows its own "leave page?" dialog while a save is pending or failed. */
function onBeforeUnload(event: BeforeUnloadEvent) {
  if (saveState.value !== 'idle' && saveState.value !== 'saved') event.preventDefault()
}

// In-app navigation bypasses beforeunload. Pending work is flushed on unmount, so only a
// failed save needs the question.
onBeforeRouteLeave(
  () => saveState.value !== 'error' || confirm('The last save failed. Leave and lose the changes?'),
)

// Editing -------------------------------------------------------------------------------

function onTextChange(next: string) {
  const before = tokens.value.map((t) => t.text)
  const after = tokenize(next).map((t) => t.text)
  spans.value = shiftSpans(before, after, spans.value)
  text.value = next
  selection.value = null
  activeSpanId.value = null
}

function onTokenClick(index: number) {
  const token = tokens.value[index]
  if (item.value)
    player.value?.seek(estimateTokenTime(token.start, text.value.length, item.value.durationSec))
  if (!editable.value) return // read-only items seek on click but never open the span form
  const covering = innermostSpanAt(spans.value, index)
  activeSpanId.value = covering?.id ?? null
  selection.value = covering ? null : { start: index, end: index + 1 }
}

/** Dragging exactly over an existing span opens it instead of offering a duplicate. */
function onSelect(start: number, end: number, forceNew: boolean) {
  if (!editable.value) return
  const existing = forceNew
    ? undefined
    : spans.value.find((s) => s.start === start && s.end === end)
  activeSpanId.value = existing?.id ?? null
  selection.value = existing ? null : { start, end }
}

function saveSpan(input: SpanInput) {
  if (activeSpan.value) {
    spans.value = spans.value.map((s) => (s.id === activeSpanId.value ? { ...input, id: s.id } : s))
  } else {
    spans.value = [...spans.value, { ...input, id: localId() }]
  }
  clearSelection()
}

function resizeSpan(start: number, end: number) {
  spans.value = spans.value.map((s) => (s.id === activeSpanId.value ? { ...s, start, end } : s))
}

/** Client-only ids; the server assigns its own. randomUUID needs a secure context, http://localhost is one. */
const localId = () => crypto.randomUUID?.() ?? `local-${Date.now()}-${Math.random()}`

/** Opens an existing span for editing, as a click on one of its words would. */
function openSpan(id: string) {
  activeSpanId.value = id
  selection.value = null
}

function deleteSpan() {
  spans.value = spans.value.filter((s) => s.id !== activeSpanId.value)
  clearSelection()
}

function clearSelection() {
  selection.value = null
  activeSpanId.value = null
}

function toggleMode() {
  if (!editable.value) return
  mode.value = mode.value === 'edit' ? 'annotate' : 'edit'
  // Entering edit mode keeps the selection: the editor puts the caret on it.
  if (mode.value === 'annotate') clearSelection()
}

// Transcript pairing --------------------------------------------------------------------

async function paste() {
  try {
    await api.pasteTranscript(props.id, pasteText.value)
    actionError.value = ''
    await load()
  } catch (e) {
    actionError.value = (e as Error).message
  }
}

async function unpair() {
  if (
    !confirm(
      'Unpair the transcript? The corrected text and all spans of this item will be removed.',
    )
  )
    return
  try {
    await api.unpair(props.id)
    actionError.value = ''
    await load()
  } catch (e) {
    actionError.value = (e as Error).message
  }
}

// Keyboard ------------------------------------------------------------------------------

function onKeydown(event: KeyboardEvent) {
  if (formSelection.value && editable.value && mode.value === 'annotate') {
    const typeIndex = matchSpanType(event)
    if (typeIndex !== null) {
      event.preventDefault()
      spanForm.value?.setType(SPAN_TYPES[typeIndex])
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      clearSelection()
      return
    }
  }
  const action = matchShortcut(event)
  if (!action) return
  event.preventDefault()
  const p = player.value
  if (action === 'togglePlay') p?.toggle()
  else if (action === 'back') p?.jump(-JUMP_SEC)
  else if (action === 'forward') p?.jump(JUMP_SEC)
  else if (action === 'backFar') p?.jump(-JUMP_FAR_SEC)
  else if (action === 'forwardFar') p?.jump(JUMP_FAR_SEC)
  else if (action === 'slower') p?.changeRate(-1)
  else if (action === 'faster') p?.changeRate(1)
  else if (action === 'toggleMode') toggleMode()
  else if (action === 'toStart') p?.seek(0)
  else if (action === 'save') void save()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('beforeunload', onBeforeUnload)
  void load()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('beforeunload', onBeforeUnload)
  clearTimeout(timer)
  // One last attempt for pending work; if it fails there is no page left to retry from.
  if (saveState.value === 'dirty' || saveState.value === 'error') void save()
})

const SAVE_LABELS = {
  idle: '',
  saved: '✓ Saved',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  error: 'Save failed',
}
</script>

<template>
  <p v-if="loadError" class="error">{{ loadError }}</p>
  <div v-else-if="item" class="stack">
    <div class="row">
      <RouterLink to="/">← Queue</RouterLink>
      <h1 style="margin: 0">{{ item.filename }}</h1>
      <span class="badge" :class="item.status">{{ STATUS_LABELS[item.status] }}</span>
      <span v-if="actionError" class="error small">{{ actionError }}</span>
      <span style="flex: 1"></span>
      <template v-if="editable">
        <span v-if="!annotator.trim()" class="small muted">No annotator name set (top right)</span>
        <span
          v-if="saveState !== 'idle'"
          class="small"
          :class="{
            error: saveState === 'error',
            ok: saveState === 'saved',
            muted: saveState === 'dirty' || saveState === 'saving',
          }"
        >
          {{ SAVE_LABELS[saveState] }}<span v-if="saveState === 'error'">: {{ saveError }}</span>
        </span>
        <button v-if="item.status === 'DONE'" @click="save('IN_PROGRESS')">Reopen</button>
        <button v-else class="primary" @click="save('DONE')">Mark done</button>
      </template>
    </div>

    <p v-if="item.status === 'AUTO_REJECTED'" class="panel muted">
      Auto-rejected: the recording is {{ MAX_AUTO_REJECT_SEC }} seconds or shorter and is not routed
      to an annotator. The transcript can be paired and unpaired but not edited.
    </p>

    <AudioPlayer ref="player" :src="api.audioUrl(item.id)" :duration="item.durationSec" />

    <div class="layout">
      <div class="stack">
        <section v-if="item.transcript === null" class="panel stack">
          <h2>No transcript yet</h2>
          <p class="muted small">
            Upload a transcript file on the <RouterLink to="/ingest">Ingest</RouterLink> page, pair
            an existing row there, or paste the model's transcript for this recording here.
          </p>
          <textarea
            v-model="pasteText"
            placeholder="Paste the AI transcript…"
            style="min-height: 6rem"
          ></textarea>
          <div>
            <button class="primary" :disabled="!pasteText.trim()" @click="paste">
              Use as transcript
            </button>
          </div>
        </section>

        <template v-else>
          <details class="panel small">
            <summary class="muted">
              Original AI transcript (immutable,
              {{ item.transcript.source === 'PASTE' ? 'pasted' : item.transcript.path }})
              <button class="small unpair" @click.prevent="unpair">Unpair</button>
            </summary>
            <p class="original">{{ item.originalText }}</p>
          </details>

          <section class="panel stack">
            <div class="row">
              <h2 style="margin: 0">Corrected transcript</h2>
              <span style="flex: 1"></span>
              <div v-if="editable" class="modes" title="Alt+E">
                <button
                  :class="{ chosen: mode === 'annotate' }"
                  @click="mode !== 'annotate' && toggleMode()"
                >
                  Annotate
                </button>
                <button
                  :class="{ chosen: mode === 'edit' }"
                  @click="mode !== 'edit' && toggleMode()"
                >
                  Edit text
                </button>
              </div>
            </div>
            <TranscriptEditor
              :text="text"
              :tokens="tokens"
              :spans="spans"
              :mode="mode"
              :selection="selection"
              :active-span-id="activeSpanId"
              :editable="editable"
              @update:text="onTextChange"
              @token-click="onTokenClick"
              @select="onSelect"
            />
          </section>
        </template>

        <ShortcutHelp />
      </div>

      <div class="stack">
        <section v-if="item.transcript" class="panel">
          <SpanForm
            v-if="formSelection && editable && mode === 'annotate'"
            ref="spanForm"
            :selection="formSelection"
            :selection-text="selectionText"
            :span="activeSpan"
            :spans="spans"
            :token-count="tokens.length"
            @save="saveSpan"
            @delete="deleteSpan"
            @open="openSpan"
            @resize="resizeSpan"
            @cancel="clearSelection"
          />
          <p v-else-if="editable" class="muted small">
            Select words in the transcript (click, drag or shift-click) to create a span, or click a
            highlighted word to edit its span.
          </p>
        </section>

        <section v-if="item.transcript" class="panel">
          <h2>Spans ({{ spans.length }})</h2>
          <SpanList
            :spans="spans"
            :tokens="tokens"
            :active-span-id="activeSpanId"
            @select="activeSpanId = $event"
          />
        </section>

        <section class="panel">
          <h2>Recording conditions</h2>
          <ConditionsPanel
            v-model:speech-rate-override="speechRateOverride"
            v-model:distance-override="distanceOverride"
            :recording="item.recording"
            :token-count="tokens.length"
            :editable="editable"
          />
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(320px, 2fr);
  gap: 1rem;
  align-items: start;
}

.original {
  margin: 0.5rem 0 0;
  line-height: 1.6;
}

.unpair {
  margin-left: 0.75rem;
  padding: 0.1rem 0.5rem;
}

.modes button {
  border-radius: 0;
}

.modes button:first-child {
  border-radius: 6px 0 0 6px;
}

.modes button:last-child {
  border-radius: 0 6px 6px 0;
  margin-left: -1px;
}

.modes button.chosen {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
}
</style>
