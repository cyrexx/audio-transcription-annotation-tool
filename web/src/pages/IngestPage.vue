<script setup lang="ts">
import type { PairingState, TranscriptImportReport } from 'shared'
import { onMounted, ref } from 'vue'
import { api } from '../lib/api.ts'
import { formatDuration, STATUS_LABELS } from '../lib/format.ts'

interface UploadRow {
  filename: string
  result: string
  itemId?: string
  error?: string
}

const uploads = ref<UploadRow[]>([])
const uploading = ref(false)
const report = ref<TranscriptImportReport | null>(null)
const transcriptError = ref('')
const pairing = ref<PairingState>({ items: [], transcripts: [] })
const selectedItem = ref('')
const selectedTranscript = ref('')
const pairError = ref('')

onMounted(refreshPairing)

async function refreshPairing() {
  pairing.value = await api.pairing()
  selectedItem.value = ''
  selectedTranscript.value = ''
}

/** One request per file, so every file gets its own verdict. */
async function uploadAudio(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  uploading.value = true
  for (const file of files) {
    const row: UploadRow = { filename: file.name, result: 'uploading…' }
    uploads.value.unshift(row)
    try {
      const res = await api.uploadAudio(file)
      row.result = `${formatDuration(res.durationSec)}, ${STATUS_LABELS[res.status]}${res.pairedTranscriptId ? ', transcript paired' : ''}`
      row.itemId = res.itemId
    } catch (e) {
      row.result = ''
      row.error = (e as Error).message
    }
  }
  uploading.value = false
  await refreshPairing()
}

async function uploadTranscripts(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  transcriptError.value = ''
  report.value = null
  try {
    report.value = await api.importTranscripts(await file.text())
  } catch (e) {
    transcriptError.value = (e as Error).message
  }
  await refreshPairing()
}

async function pair() {
  pairError.value = ''
  try {
    await api.pair(selectedItem.value, selectedTranscript.value)
    await refreshPairing()
  } catch (e) {
    pairError.value = (e as Error).message
  }
}
</script>

<template>
  <div class="stack">
    <h1>Ingest</h1>

    <section class="panel stack">
      <h2>1. Audio files</h2>
      <p class="muted small">
        .wav, .mp3 or .m4a, one or many. Each file is validated by its content; duration is read on
        the server. Recordings of 15 seconds or less are auto-rejected.
      </p>
      <input
        type="file"
        multiple
        accept=".wav,.mp3,.m4a"
        :disabled="uploading"
        @change="uploadAudio"
      />
      <ul v-if="uploads.length" class="plain small">
        <li v-for="row in uploads" :key="row.filename + row.result + row.error">
          <RouterLink v-if="row.itemId" :to="`/items/${row.itemId}`">{{ row.filename }}</RouterLink>
          <span v-else>{{ row.filename }}</span>
          <span v-if="row.error" class="error"> — rejected: {{ row.error }}</span>
          <span v-else class="muted"> — {{ row.result }}</span>
        </li>
      </ul>
    </section>

    <section class="panel stack">
      <h2>2. Transcript file</h2>
      <p class="muted small">
        A JSON array of <code>{ "path", "label" }</code> objects. Rows are matched to audio by
        filename; every bad row is reported and the good ones are kept. You can also paste a
        transcript on an item's page.
      </p>
      <input type="file" accept=".json,application/json" @change="uploadTranscripts" />
      <p v-if="transcriptError" class="error small">{{ transcriptError }}</p>
      <div v-if="report" class="small stack" style="gap: 0.25rem">
        <p class="ok">
          {{ report.accepted.length }} accepted,
          {{ report.accepted.filter((a) => a.pairedItemId).length }} paired with audio.
        </p>
        <ul v-if="report.rejected.length" class="plain">
          <li v-for="r in report.rejected" :key="r.index" class="error">
            Row {{ r.index }}<span v-if="r.path"> ({{ r.path }})</span>: {{ r.reason }}
          </li>
        </ul>
      </div>
    </section>

    <section class="panel stack">
      <h2>3. Pairing</h2>
      <p class="muted small">
        What has no partner yet, on both sides. Select one of each and pair them. Unpairing is on
        the item page.
      </p>
      <div class="columns">
        <div>
          <h3>Audio without transcript ({{ pairing.items.length }})</h3>
          <p v-if="!pairing.items.length" class="muted small">none</p>
          <label v-for="item in pairing.items" :key="item.id" class="option">
            <input v-model="selectedItem" type="radio" :value="item.id" />
            <RouterLink :to="`/items/${item.id}`">{{ item.filename }}</RouterLink>
            <span class="muted small">{{ formatDuration(item.durationSec) }}</span>
          </label>
        </div>
        <div>
          <h3>Transcripts without audio ({{ pairing.transcripts.length }})</h3>
          <p v-if="!pairing.transcripts.length" class="muted small">none</p>
          <label v-for="t in pairing.transcripts" :key="t.id" class="option">
            <input v-model="selectedTranscript" type="radio" :value="t.id" />
            <span>{{ t.path }}</span>
            <span class="muted small">{{ t.preview }}</span>
          </label>
        </div>
      </div>
      <div class="row">
        <button class="primary" :disabled="!selectedItem || !selectedTranscript" @click="pair">
          Pair selected
        </button>
        <span v-if="pairError" class="error small">{{ pairError }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.option {
  display: grid;
  grid-template-columns: auto auto 1fr;
  gap: 0.5rem;
  align-items: baseline;
  padding: 0.25rem 0;
}

.option .small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
