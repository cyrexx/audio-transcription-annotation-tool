<script setup lang="ts">
import { tokenize, type Span, type SpanInput } from 'shared'
import { computed, ref } from 'vue'

type EditorSpan = SpanInput & { id: string }

const props = defineProps<{
  text: string
  spans: EditorSpan[]
  mode: 'edit' | 'annotate'
  selection: { start: number; end: number } | null
  activeSpanId: string | null
  editable: boolean
}>()

const emit = defineEmits<{
  'update:text': [text: string]
  tokenClick: [index: number]
  select: [start: number, end: number]
}>()

const tokens = computed(() => tokenize(props.text))

/** Spans covering each token, innermost first, so the tightest span decides the colour. */
const coverage = computed(() =>
  tokens.value.map((_, i) =>
    props.spans
      .filter((s) => s.start <= i && i < s.end)
      .sort((a, b) => a.end - a.start - (b.end - b.start)),
  ),
)

function tokenStyle(i: number) {
  const [inner, outer] = coverage.value[i]
  if (!inner) return undefined
  return {
    '--c': `var(--type-${inner.type})`,
    '--outer': outer ? `var(--type-${outer.type})` : 'transparent',
  }
}

function tokenClass(i: number) {
  const covering = coverage.value[i]
  return {
    'in-span': covering.length > 0,
    nested: covering.length > 1,
    active: covering.some((s) => s.id === props.activeSpanId),
    selected: props.selection !== null && props.selection.start <= i && i < props.selection.end,
    'span-start': covering.some((s) => s.start === i),
    'span-end': covering.some((s) => s.end === i + 1),
  }
}

const anchor = ref<number | null>(null)

function onMouseUp(i: number, event: MouseEvent) {
  const from = anchor.value
  anchor.value = null
  if (event.shiftKey) {
    // Starts or extends a selection, also inside an existing span (a plain click would open it).
    const current = props.selection ?? { start: i, end: i + 1 }
    emit('select', Math.min(current.start, i), Math.max(current.end, i + 1))
  } else if (from === null || from === i) {
    emit('tokenClick', i)
  } else {
    emit('select', Math.min(from, i), Math.max(from, i) + 1)
  }
}

defineExpose({ tokens })
export type { EditorSpan, Span }
</script>

<template>
  <textarea
    v-if="mode === 'edit'"
    :value="text"
    :readonly="!editable"
    spellcheck="false"
    @input="emit('update:text', ($event.target as HTMLTextAreaElement).value)"
  ></textarea>
  <p v-else-if="tokens.length === 0" class="muted">The corrected transcript is empty.</p>
  <p v-else class="tokens" @mouseleave="anchor = null">
    <template v-for="(token, i) in tokens" :key="i">
      <span
        class="tok"
        :class="tokenClass(i)"
        :style="tokenStyle(i)"
        @mousedown.prevent="anchor = i"
        @mouseup="onMouseUp(i, $event)"
        >{{ token.text }}</span
      >{{ ' ' }}
    </template>
  </p>
</template>

<style scoped>
.tokens {
  margin: 0;
  line-height: 2.1;
  font-size: 1.05rem;
  user-select: none;
}

.tok {
  padding: 0.15rem 0.1rem;
  border-radius: 3px;
  cursor: pointer;
}

.tok:hover {
  background: var(--accent-soft);
}

.in-span {
  background: color-mix(in srgb, var(--c) 16%, transparent);
  border-bottom: 2px solid var(--c);
  border-radius: 0;
}

.in-span.span-start {
  border-top-left-radius: 3px;
  border-bottom-left-radius: 3px;
}

.in-span.span-end {
  border-top-right-radius: 3px;
  border-bottom-right-radius: 3px;
}

.nested {
  box-shadow: 0 4px 0 var(--outer);
}

.selected {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}

.active {
  background: color-mix(in srgb, var(--c) 35%, transparent);
}
</style>
