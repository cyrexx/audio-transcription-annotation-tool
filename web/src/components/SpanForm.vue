<script setup lang="ts">
import {
  ENTITY_KINDS,
  FORMATTING_COMMANDS,
  FORMATTING_INTERPRETATIONS,
  MEASUREMENT_UNITS,
  MEDICAL_CATEGORIES,
  NUMBER_RENDERINGS,
  normalizeMeasurement,
  sameTypeAndRange,
  SPAN_TYPES,
  spanInputSchema,
  type MeasurementUnit,
  type SpanInput,
  type SpanType,
} from 'shared'
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import type { EditorSpan } from '../lib/spans.ts'

const props = defineProps<{
  selection: { start: number; end: number }
  selectionText: string
  /** Set when editing an existing span; null when creating one for the selection. */
  span: EditorSpan | null
  /** All spans of the item, to refuse a second one of the same type on the same words. */
  spans: EditorSpan[]
  tokenCount: number
}>()

const emit = defineEmits<{
  save: [span: SpanInput]
  delete: []
  cancel: []
  /** Open another span for editing, used when the new one would duplicate it. */
  open: [id: string]
  /** Moves an existing span's boundaries; applied immediately so the highlight follows. */
  resize: [start: number, end: number]
}>()

/** Unique prefix so every label points at its own control. */
const uid = useId()

const single = computed(() => props.selection.end - props.selection.start <= 1)
function resize(dStart: number, dEnd: number) {
  const start = props.selection.start + dStart
  const end = props.selection.end + dEnd
  const existing = props.spans.find(
    (s) =>
      s.id !== props.span?.id &&
      props.span &&
      sameTypeAndRange(s, { type: props.span.type, start, end }),
  )
  if (existing) {
    twin.value = existing
    error.value = `A ${label(existing.type)} span already covers those words.`
    return
  }
  emit('resize', start, end)
}

type Attrs = Record<string, string | number | null>

const DEFAULTS: Record<SpanType, Attrs> = {
  NUMBER: { rendering: 'words', value: '' },
  FORMATTING_COMMAND: { command: 'newline', interpretation: 'command' },
  SPELLED_OUT: { resolved: '' },
  NAMED_ENTITY: { kind: 'person' },
  MEDICAL_TERM: { category: 'drug', note: '' },
  MEASUREMENT: { value: null, unit: 'mg' },
}

const type = ref<SpanType>('MEDICAL_TERM')
const attrs = ref<Attrs>({ ...DEFAULTS.MEDICAL_TERM })
const error = ref('')
/** The existing span a refused duplicate points at. */
const twin = ref<EditorSpan | null>(null)

// A new selection or a different span starts the form over; resizing the open span keeps it.
watch(
  () => [props.span, props.span ? null : props.selection] as const,
  ([span]) => {
    type.value = span?.type ?? 'MEDICAL_TERM'
    attrs.value = { ...DEFAULTS[type.value], ...(span?.attributes as Attrs | undefined) }
    error.value = ''
    twin.value = null
    focusFirstField()
  },
  { immediate: true },
)

const fields = useTemplateRef<HTMLDivElement>('fields')

/** Puts the keyboard into the form, so Tab walks the attributes instead of the page behind. */
function focusFirstField() {
  void nextTick(() => fields.value?.querySelector<HTMLElement>('input, select')?.focus())
}

function setType(next: SpanType) {
  type.value = next
  attrs.value = { ...DEFAULTS[next] }
  error.value = ''
  twin.value = null
  focusFirstField()
}

const normalized = computed(() => {
  const value = Number(attrs.value.value)
  if (type.value !== 'MEASUREMENT' || !Number.isFinite(value) || attrs.value.value === null)
    return null
  return normalizeMeasurement(value, attrs.value.unit as MeasurementUnit)
})

function save() {
  twin.value = null
  const candidate = { type: type.value, ...props.selection, attributes: attrs.value }
  const result = spanInputSchema.safeParse(candidate)
  if (!result.success) {
    const issue = result.error.issues[0]
    error.value = `${issue.path.filter((p) => p !== 'attributes').join('.') || 'value'}: ${issue.message}`
    return
  }
  const existing = props.spans.find(
    (s) => s.id !== props.span?.id && sameTypeAndRange(s, result.data),
  )
  if (existing) {
    twin.value = existing
    error.value = `A ${label(existing.type)} span already covers these words.`
    return
  }
  emit('save', result.data)
}

const label = (value: string) => value.replaceAll('_', ' ')

defineExpose({ setType })
</script>

<template>
  <form class="stack" @submit.prevent="save">
    <div class="row">
      <strong>{{ span ? 'Edit span' : 'New span' }}</strong>
      <span class="muted small">
        tokens {{ selection.start }}–{{ selection.end - 1 }}: „{{ selectionText }}“
      </span>
    </div>

    <div v-if="span" class="row small resize">
      <span class="muted">Start</span>
      <button
        type="button"
        title="Include the previous word"
        :disabled="selection.start === 0"
        @click="resize(-1, 0)"
      >
        ◀
      </button>
      <button type="button" title="Drop the first word" :disabled="single" @click="resize(1, 0)">
        ▶
      </button>
      <span class="muted">End</span>
      <button type="button" title="Drop the last word" :disabled="single" @click="resize(0, -1)">
        ◀
      </button>
      <button
        type="button"
        title="Include the next word"
        :disabled="selection.end >= tokenCount"
        @click="resize(0, 1)"
      >
        ▶
      </button>
    </div>

    <div class="types">
      <button
        v-for="(t, index) in SPAN_TYPES"
        :key="t"
        type="button"
        class="type-btn"
        :class="{ chosen: t === type }"
        :style="{ '--c': `var(--type-${t})` }"
        :title="`Alt+${index + 1}`"
        @click="setType(t)"
      >
        {{ label(t) }}
      </button>
    </div>

    <div ref="fields" class="fields">
      <template v-if="type === 'NUMBER'">
        <span>Rendering</span>
        <div class="row">
          <label v-for="r in NUMBER_RENDERINGS" :key="r" class="row"
            ><input v-model="attrs.rendering" type="radio" :value="r" />{{ r }}</label
          >
        </div>
        <label :for="`${uid}-value`">Normalized value</label>
        <input :id="`${uid}-value`" v-model="attrs.value" type="text" placeholder="12, 6/0, 2026" />
      </template>

      <template v-else-if="type === 'FORMATTING_COMMAND'">
        <label :for="`${uid}-command`">Command</label>
        <select :id="`${uid}-command`" v-model="attrs.command">
          <option v-for="c in FORMATTING_COMMANDS" :key="c" :value="c">{{ label(c) }}</option>
        </select>
        <span>Meaning</span>
        <div class="row">
          <label v-for="i in FORMATTING_INTERPRETATIONS" :key="i" class="row"
            ><input v-model="attrs.interpretation" type="radio" :value="i" />{{ i }}</label
          >
        </div>
      </template>

      <template v-else-if="type === 'SPELLED_OUT'">
        <label :for="`${uid}-resolved`">Resolved word</label>
        <input
          :id="`${uid}-resolved`"
          v-model="attrs.resolved"
          type="text"
          placeholder="Cefuroxim"
        />
      </template>

      <template v-else-if="type === 'NAMED_ENTITY'">
        <label :for="`${uid}-kind`">Kind</label>
        <select :id="`${uid}-kind`" v-model="attrs.kind">
          <option v-for="k in ENTITY_KINDS" :key="k" :value="k">{{ k }}</option>
        </select>
      </template>

      <template v-else-if="type === 'MEDICAL_TERM'">
        <label :for="`${uid}-category`">Category</label>
        <select :id="`${uid}-category`" v-model="attrs.category">
          <option v-for="c in MEDICAL_CATEGORIES" :key="c" :value="c">{{ c }}</option>
        </select>
        <label :for="`${uid}-note`">Note</label>
        <input :id="`${uid}-note`" v-model="attrs.note" type="text" placeholder="optional" />
      </template>

      <template v-else-if="type === 'MEASUREMENT'">
        <label :for="`${uid}-measure`">Value</label>
        <input
          :id="`${uid}-measure`"
          v-model.number="attrs.value"
          type="number"
          step="any"
          placeholder="1500"
        />
        <label :for="`${uid}-unit`">Unit</label>
        <select :id="`${uid}-unit`" v-model="attrs.unit">
          <option v-for="u in MEASUREMENT_UNITS" :key="u" :value="u">{{ u }}</option>
        </select>
        <span>Normalized</span>
        <span class="muted">{{
          normalized ? `${normalized.normalizedValue} ${normalized.normalizedUnit}` : '—'
        }}</span>
      </template>
    </div>

    <p v-if="error" class="error small">
      {{ error }}
      <button v-if="twin" type="button" class="small" @click="emit('open', twin.id)">
        Open it
      </button>
    </p>
    <div class="row">
      <button type="submit" class="primary">{{ span ? 'Update' : 'Add span' }}</button>
      <button v-if="span" type="button" class="danger" @click="emit('delete')">Delete</button>
      <button type="button" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>

<style scoped>
.types {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.type-btn {
  border-color: var(--c);
  color: var(--c);
  font-size: 0.85rem;
}

.type-btn.chosen {
  background: var(--c);
  color: #fff;
}

.resize button {
  padding: 0.1rem 0.5rem;
  font-size: 0.7rem;
}

.resize .muted:not(:first-child) {
  margin-left: 0.5rem;
}

.fields {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem 0.75rem;
  align-items: center;
}

.fields > label,
.fields > span:not(.muted) {
  color: var(--muted);
  font-size: 0.85rem;
}
</style>
