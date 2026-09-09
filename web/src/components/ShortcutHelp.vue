<script setup lang="ts">
import { OTHER_SHORTCUTS, SHORTCUTS } from '../lib/shortcuts.ts'
</script>

<template>
  <details class="panel small">
    <summary>Keyboard shortcuts and mouse actions</summary>
    <div class="columns">
      <table>
        <tbody>
          <tr v-for="s in SHORTCUTS" :key="s.action">
            <td>
              <kbd>{{ s.keys }}</kbd>
            </td>
            <td>{{ s.label }}</td>
          </tr>
          <tr v-for="s in OTHER_SHORTCUTS" :key="s.keys">
            <td>
              <kbd>{{ s.keys }}</kbd>
            </td>
            <td>{{ s.label }}</td>
          </tr>
        </tbody>
      </table>
      <table>
        <tbody>
          <tr>
            <td>Click a word</td>
            <td>Jump the audio to that word (estimated position)</td>
          </tr>
          <tr>
            <td>Click a highlighted word</td>
            <td>Open that span for editing</td>
          </tr>
          <tr>
            <td>Drag across words</td>
            <td>Select a range for a new span; dragging exactly over an existing span opens it</td>
          </tr>
          <tr>
            <td>Shift + click</td>
            <td>
              Start or extend a selection for a new span, even over words that already have one
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="muted">
      Shortcuts use Alt (Option on Mac) so they also work while typing in the transcript.
    </p>
  </details>
</template>

<style scoped>
summary {
  cursor: pointer;
}

.columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-top: 0.75rem;
}

td:first-child {
  white-space: nowrap;
  width: 1%;
}
</style>
