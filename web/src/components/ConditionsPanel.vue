<script setup lang="ts">
import {
  DISTANCE_ESTIMATES,
  speechRateWpm,
  type DistanceEstimate,
  type RecordingConditions,
} from 'shared'
import { computed } from 'vue'
import { formatDuration } from '../lib/format.ts'

const props = defineProps<{
  recording: RecordingConditions
  tokenCount: number
  editable: boolean
}>()
const speechRateOverride = defineModel<number | null>('speechRateOverride', { required: true })
const distanceOverride = defineModel<DistanceEstimate | null>('distanceOverride', {
  required: true,
})

const derivedRate = computed(() => speechRateWpm(props.tokenCount, props.recording.durationSec))
const metadata = computed(() => Object.entries(props.recording.metadata))

function onRateInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  speechRateOverride.value = raw === '' ? null : Number(raw)
}

function onDistanceChange(event: Event) {
  const raw = (event.target as HTMLSelectElement).value
  distanceOverride.value = raw === '' ? null : (raw as DistanceEstimate)
}

const db = (value: number) => `${value.toFixed(1)} dBFS`
</script>

<template>
  <div class="stack" style="gap: 0.75rem">
    <table class="facts">
      <tbody>
        <tr>
          <th>Duration</th>
          <td>{{ formatDuration(recording.durationSec) }}</td>
        </tr>
        <tr>
          <th>Sample rate</th>
          <td>{{ recording.sampleRate ? `${recording.sampleRate} Hz` : 'n/a' }}</td>
        </tr>
        <tr>
          <th>Channels</th>
          <td>{{ recording.channels ?? 'n/a' }}</td>
        </tr>
        <tr>
          <th>Bit depth</th>
          <td>{{ recording.bitDepth ?? 'n/a (lossy)' }}</td>
        </tr>
        <tr>
          <th>Format</th>
          <td>{{ recording.container }} / {{ recording.codec }}</td>
        </tr>
        <tr v-for="[key, value] in metadata" :key="key">
          <th>{{ key }}</th>
          <td>{{ value }}</td>
        </tr>
        <tr v-if="metadata.length === 0">
          <th>bext / INFO</th>
          <td class="muted">none written by the recorder</td>
        </tr>
      </tbody>
    </table>

    <div class="derived">
      <h3>Speech rate <span class="muted small">(derived)</span></h3>
      <p class="small">
        {{ derivedRate === null ? 'n/a' : `${derivedRate} words/min` }}
        <span class="muted"
          >from {{ tokenCount }} tokens over {{ recording.durationSec.toFixed(1) }} s</span
        >
      </p>
      <label class="row small">
        Override
        <input
          type="number"
          min="0"
          step="1"
          :value="speechRateOverride ?? ''"
          :disabled="!editable"
          placeholder="words/min"
          @input="onRateInput"
        />
      </label>
    </div>

    <div class="derived">
      <h3>Microphone distance <span class="muted small">(estimate)</span></h3>
      <template v-if="recording.levels">
        <p class="small">
          <strong>{{ recording.distanceEstimate }}</strong>
          <span class="muted">
            · RMS {{ db(recording.levels.rmsDbfs) }}, peak {{ db(recording.levels.peakDbfs) }},
            noise floor {{ db(recording.levels.noiseFloorDbfs) }}, level-to-noise
            {{ recording.levels.snrDb.toFixed(1) }} dB
          </span>
        </p>
      </template>
      <p v-else class="small error">Not available: {{ recording.levelsError }}</p>
      <label class="row small">
        Override
        <select :value="distanceOverride ?? ''" :disabled="!editable" @change="onDistanceChange">
          <option value="">use estimate</option>
          <option v-for="d in DISTANCE_ESTIMATES" :key="d" :value="d">{{ d }}</option>
        </select>
      </label>
      <p class="muted small">
        A heuristic, not a measurement: a speaker close to the microphone gives a hot signal far
        above the room's noise floor. Gain normalisation and automatic gain control fool it.
      </p>
    </div>
  </div>
</template>

<style scoped>
.facts th {
  width: 1%;
  white-space: nowrap;
  font-weight: 500;
}

.facts td,
.facts th {
  padding: 0.25rem 0.5rem;
  font-size: 0.85rem;
}

.derived p {
  margin: 0.25rem 0;
}

.derived input {
  width: 7rem;
}
</style>
