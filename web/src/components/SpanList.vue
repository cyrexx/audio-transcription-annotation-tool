<script setup lang="ts">
import type { Token } from 'shared'
import { computed } from 'vue'
import type { EditorSpan } from '../lib/spans.ts'

const props = defineProps<{ spans: EditorSpan[]; tokens: Token[]; activeSpanId: string | null }>()
const emit = defineEmits<{ select: [id: string] }>()

const sorted = computed(() => [...props.spans].sort((a, b) => a.start - b.start || a.end - b.end))

const text = (span: EditorSpan) =>
  props.tokens
    .slice(span.start, span.end)
    .map((t) => t.text)
    .join(' ')

/** The one or two attributes worth showing in the list. */
function summary(span: EditorSpan): string {
  switch (span.type) {
    case 'NUMBER':
      return `${span.attributes.value} (${span.attributes.rendering})`
    case 'FORMATTING_COMMAND': {
      const { command, interpretation } = span.attributes
      return `${command.replaceAll('_', ' ')}${interpretation === 'literal' ? ', literal' : ''}`
    }
    case 'SPELLED_OUT':
      return span.attributes.resolved
    case 'NAMED_ENTITY':
      return span.attributes.kind
    case 'MEDICAL_TERM': {
      const { category, note } = span.attributes
      return `${category}${note ? `, ${note}` : ''}`
    }
    case 'MEASUREMENT':
      return `${span.attributes.value} ${span.attributes.unit}`
  }
}
</script>

<template>
  <p v-if="spans.length === 0" class="muted small">
    No spans yet. Select words in annotate mode to add one.
  </p>
  <ul v-else class="plain">
    <li
      v-for="span in sorted"
      :key="span.id"
      class="item"
      :class="{ active: span.id === activeSpanId }"
      @click="emit('select', span.id)"
    >
      <span class="type-badge" :style="{ background: `var(--type-${span.type})` }">{{
        span.type.replaceAll('_', ' ')
      }}</span>
      <span class="text">{{ text(span) }}</span>
      <span class="muted small">{{ summary(span) }}</span>
    </li>
  </ul>
</template>

<style scoped>
.item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.15rem 0.5rem;
  padding: 0.4rem 0.5rem;
  border-radius: 6px;
  cursor: pointer;
}

.item:hover,
.item.active {
  background: var(--accent-soft);
}

.item .small {
  grid-column: 2;
}

.text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
