import { describe, expect, it } from 'vitest'
import { finalizeSpan, sameTypeAndRange, spanInputSchema } from './annotation.ts'

describe('spanInputSchema', () => {
  it('accepts every type with its attributes', () => {
    const spans = [
      { type: 'NUMBER', start: 0, end: 2, attributes: { rendering: 'words', value: '6/0' } },
      {
        type: 'FORMATTING_COMMAND',
        start: 0,
        end: 2,
        attributes: { command: 'newline', interpretation: 'command' },
      },
      { type: 'SPELLED_OUT', start: 0, end: 9, attributes: { resolved: 'Cefuroxim' } },
      { type: 'NAMED_ENTITY', start: 0, end: 1, attributes: { kind: 'person' } },
      { type: 'MEDICAL_TERM', start: 0, end: 1, attributes: { category: 'drug' } },
      { type: 'MEASUREMENT', start: 0, end: 2, attributes: { value: 1500, unit: 'mg' } },
    ]
    for (const span of spans) {
      expect(spanInputSchema.safeParse(span).success, span.type).toBe(true)
    }
  })

  it('rejects attributes that do not belong to the type', () => {
    const wrong = { type: 'NUMBER', start: 0, end: 1, attributes: { kind: 'person' } }
    expect(spanInputSchema.safeParse(wrong).success).toBe(false)
  })

  it('rejects enum values outside the brief', () => {
    const wrong = { type: 'MEASUREMENT', start: 0, end: 1, attributes: { value: 1, unit: 'oz' } }
    expect(spanInputSchema.safeParse(wrong).success).toBe(false)
  })

  it('rejects negative measurements', () => {
    const wrong = { type: 'MEASUREMENT', start: 0, end: 1, attributes: { value: -5, unit: 'mg' } }
    expect(spanInputSchema.safeParse(wrong).success).toBe(false)
  })

  it('rejects empty and inverted ranges', () => {
    const base = { type: 'NAMED_ENTITY', attributes: { kind: 'place' } }
    expect(spanInputSchema.safeParse({ ...base, start: 2, end: 2 }).success).toBe(false)
    expect(spanInputSchema.safeParse({ ...base, start: 3, end: 2 }).success).toBe(false)
    expect(spanInputSchema.safeParse({ ...base, start: -1, end: 2 }).success).toBe(false)
  })

  it('strips unknown attribute keys so clients cannot smuggle data', () => {
    const parsed = spanInputSchema.parse({
      type: 'NAMED_ENTITY',
      start: 0,
      end: 1,
      attributes: { kind: 'date', extra: 'x' },
    })
    expect(parsed.attributes).toEqual({ kind: 'date' })
  })
})

describe('finalizeSpan', () => {
  it('adds the normalized value to measurements', () => {
    const span = spanInputSchema.parse({
      type: 'MEASUREMENT',
      start: 0,
      end: 2,
      attributes: { value: 1500, unit: 'mg' },
    })
    expect(finalizeSpan(span).attributes).toEqual({
      value: 1500,
      unit: 'mg',
      normalizedValue: 1.5,
      normalizedUnit: 'g',
    })
  })

  it('leaves other types untouched', () => {
    const span = spanInputSchema.parse({
      type: 'MEDICAL_TERM',
      start: 0,
      end: 1,
      attributes: { category: 'device', note: 'suture' },
    })
    expect(finalizeSpan(span)).toEqual(span)
  })
})

describe('sameTypeAndRange', () => {
  it('treats the same type on the same words as one annotation, whatever the attributes', () => {
    const a = { type: 'MEDICAL_TERM', start: 2, end: 3 } as const
    expect(sameTypeAndRange(a, { ...a })).toBe(true)
    expect(sameTypeAndRange(a, { ...a, type: 'SPELLED_OUT' })).toBe(false)
    expect(sameTypeAndRange(a, { ...a, end: 4 })).toBe(false)
  })
})
