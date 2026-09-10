import { describe, expect, it } from 'vitest'
import { coveringSpans, innermostSpanAt, withoutTwins } from './spans.ts'

const span = (type: string, start: number, end: number, id = `${type}-${start}-${end}`) =>
  ({ id, type, start, end }) as {
    id: string
    type: 'NUMBER' | 'MEDICAL_TERM'
    start: number
    end: number
  }

describe('withoutTwins', () => {
  it('keeps the first of two same-type spans pushed onto the same words', () => {
    // Two MEDICAL_TERM spans on "Leisten" and "Hernie" both land on "Leistenhernie" after a join.
    const twins = [span('MEDICAL_TERM', 2, 3, 'a'), span('MEDICAL_TERM', 2, 3, 'b')]
    expect(withoutTwins(twins).map((s) => s.id)).toEqual(['a'])
  })

  it('leaves different types on the same words alone', () => {
    const spans = [span('MEDICAL_TERM', 2, 3), span('NUMBER', 2, 3)]
    expect(withoutTwins(spans)).toEqual(spans)
  })
})

describe('coveringSpans and innermostSpanAt', () => {
  it('orders covering spans innermost first', () => {
    const outer = span('MEDICAL_TERM', 0, 3)
    const inner = span('NUMBER', 1, 2)
    expect(coveringSpans([outer, inner], 1)).toEqual([inner, outer])
    expect(innermostSpanAt([outer, inner], 1)).toBe(inner)
    expect(innermostSpanAt([outer, inner], 5)).toBeUndefined()
  })
})
