<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { formatDuration } from '../lib/format.ts'
import { JUMP_FAR_SEC, JUMP_SEC } from '../lib/shortcuts.ts'

const props = defineProps<{ src: string; duration: number }>()
const emit = defineEmits<{ time: [seconds: number] }>()

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

const audio = useTemplateRef<HTMLAudioElement>('audio')
const playing = ref(false)
const currentTime = ref(0)
const rate = ref(1)

function toggle() {
  if (!audio.value) return
  if (audio.value.paused) void audio.value.play()
  else audio.value.pause()
}

function seek(seconds: number) {
  if (!audio.value) return
  audio.value.currentTime = Math.max(0, Math.min(props.duration, seconds))
  onTime()
}

const jump = (delta: number) => seek((audio.value?.currentTime ?? 0) + delta)

function changeRate(step: number) {
  const index = RATES.indexOf(rate.value) + step
  setRate(RATES[Math.max(0, Math.min(RATES.length - 1, index))])
}

function setRate(value: number) {
  rate.value = value
  if (audio.value) audio.value.playbackRate = value
}

function onTime() {
  currentTime.value = audio.value?.currentTime ?? 0
  emit('time', currentTime.value)
}

defineExpose({ toggle, seek, jump, changeRate })
</script>

<template>
  <div class="player panel">
    <audio
      ref="audio"
      :src="src"
      preload="metadata"
      @play="playing = true"
      @pause="playing = false"
      @timeupdate="onTime"
    ></audio>
    <button title="Alt+Shift+J" @click="jump(-JUMP_FAR_SEC)">« {{ JUMP_FAR_SEC }}s</button>
    <button title="Alt+J" @click="jump(-JUMP_SEC)">‹ {{ JUMP_SEC }}s</button>
    <button class="primary play" title="Alt+K" @click="toggle">
      {{ playing ? 'Pause' : 'Play' }}
    </button>
    <button title="Alt+L" @click="jump(JUMP_SEC)">{{ JUMP_SEC }}s ›</button>
    <button title="Alt+Shift+L" @click="jump(JUMP_FAR_SEC)">{{ JUMP_FAR_SEC }}s »</button>
    <span class="time">{{ formatDuration(currentTime) }} / {{ formatDuration(duration) }}</span>
    <input
      class="seek"
      type="range"
      min="0"
      :max="duration"
      step="0.05"
      :value="currentTime"
      @input="seek(Number(($event.target as HTMLInputElement).value))"
    />
    <label class="row small" title="Alt+, and Alt+.">
      Speed
      <select :value="rate" @change="setRate(Number(($event.target as HTMLSelectElement).value))">
        <option v-for="r in RATES" :key="r" :value="r">{{ r }}×</option>
      </select>
    </label>
  </div>
</template>

<style scoped>
.player {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  position: sticky;
  top: 0.5rem;
  z-index: 1;
}

.play {
  min-width: 5rem;
}

.time {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.seek {
  flex: 1;
}
</style>
