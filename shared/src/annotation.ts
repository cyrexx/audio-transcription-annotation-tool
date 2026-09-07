import { z } from 'zod'
import { MEASUREMENT_UNITS, normalizeMeasurement } from './units.ts'

export const SPAN_TYPES = [
  'NUMBER',
  'FORMATTING_COMMAND',
  'SPELLED_OUT',
  'NAMED_ENTITY',
  'MEDICAL_TERM',
  'MEASUREMENT',
] as const
export type SpanType = (typeof SPAN_TYPES)[number]

export const NUMBER_RENDERINGS = ['digits', 'words'] as const
export const FORMATTING_COMMANDS = [
  'newline',
  'paragraph',
  'period',
  'comma',
  'colon',
  'dash',
  'bracket_open',
  'bracket_close',
] as const
export const FORMATTING_INTERPRETATIONS = ['command', 'literal'] as const
export const ENTITY_KINDS = ['person', 'organisation', 'place', 'date'] as const
export const MEDICAL_CATEGORIES = ['anatomy', 'procedure', 'diagnosis', 'drug', 'device'] as const

/** Token range over the corrected transcript, end exclusive. */
const range = {
  start: z.number().int().min(0),
  end: z.number().int().min(1),
}

const spanBody = z.discriminatedUnion('type', [
  z.object({
    ...range,
    type: z.literal('NUMBER'),
    attributes: z.object({
      rendering: z.enum(NUMBER_RENDERINGS),
      /** Normalized value as text, because "sechs null" means 6/0 and is not a number. */
      value: z.string().trim().min(1),
    }),
  }),
  z.object({
    ...range,
    type: z.literal('FORMATTING_COMMAND'),
    attributes: z.object({
      command: z.enum(FORMATTING_COMMANDS),
      interpretation: z.enum(FORMATTING_INTERPRETATIONS),
    }),
  }),
  z.object({
    ...range,
    type: z.literal('SPELLED_OUT'),
    attributes: z.object({ resolved: z.string().trim().min(1) }),
  }),
  z.object({
    ...range,
    type: z.literal('NAMED_ENTITY'),
    attributes: z.object({ kind: z.enum(ENTITY_KINDS) }),
  }),
  z.object({
    ...range,
    type: z.literal('MEDICAL_TERM'),
    attributes: z.object({
      category: z.enum(MEDICAL_CATEGORIES),
      note: z.string().trim().default(''),
    }),
  }),
  z.object({
    ...range,
    type: z.literal('MEASUREMENT'),
    attributes: z.object({
      value: z.number().finite(),
      unit: z.enum(MEASUREMENT_UNITS),
    }),
  }),
])

/** A span as the client submits it. Derived attributes are filled in by `finalizeSpan`. */
export const spanInputSchema = spanBody.refine((s) => s.start < s.end, {
  message: 'start must be smaller than end',
  path: ['end'],
})
export type SpanInput = z.infer<typeof spanInputSchema>

type Finalized<T> = T extends { type: 'MEASUREMENT'; attributes: infer A }
  ? Omit<T, 'attributes'> & { attributes: A & { normalizedValue: number; normalizedUnit: string } }
  : T

/** A stored span: input plus derived attributes. */
export type Span = Finalized<SpanInput> & { id: string }
export type SpanAttributes = Span['attributes']

/** Adds attributes the annotator does not enter by hand. */
export function finalizeSpan(span: SpanInput): Finalized<SpanInput> {
  if (span.type !== 'MEASUREMENT') return span
  const { value, unit } = span.attributes
  return { ...span, attributes: { value, unit, ...normalizeMeasurement(value, unit) } }
}
