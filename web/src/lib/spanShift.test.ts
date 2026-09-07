import { describe, expect, it } from 'vitest'
import { shiftSpans } from './spanShift.ts'

const words = (s: string) => s.split(' ')
const span = (start: number, end: number, id = 's') => ({ id, start, end })

describe('shiftSpans', () => {
  it('leaves spans alone when the text did not change', () => {
    const spans = [span(0, 1), span(2, 4)]
    expect(shiftSpans(words('a b c d'), words('a b c d'), spans)).toEqual(spans)
  })

  it('keeps a span whose own word was corrected', () => {
    const before = words('mit Cefuroxin eintausend Milligramm')
    const after = words('mit Cefuroxim eintausend Milligramm')
    expect(shiftSpans(before, after, [span(1, 2)])).toEqual([span(1, 2)])
  })

  it('shifts spans after an insertion and leaves spans before it', () => {
    const before = words('Prolene sechs null fortlaufend')
    const after = words('Prolene Naht sechs null fortlaufend')
    expect(shiftSpans(before, after, [span(0, 1, 'device'), span(1, 3, 'number')])).toEqual([
      span(0, 1, 'device'),
      span(2, 4, 'number'),
    ])
  })

  it('shifts spans after a deletion', () => {
    const before = words('a b c d e')
    const after = words('a d e')
    expect(shiftSpans(before, after, [span(3, 5)])).toEqual([span(1, 3)])
  })

  it('shrinks a span when two of its words are joined', () => {
    const before = words('Diagnose Leisten Hernie rechts')
    const after = words('Diagnose Leistenhernie rechts')
    expect(shiftSpans(before, after, [span(1, 3)])).toEqual([span(1, 2)])
  })

  it('grows a span when a word inside it is split', () => {
    const before = words('mit Cefuroxim Milligramm')
    const after = words('mit Cefu roxim Milligramm')
    expect(shiftSpans(before, after, [span(1, 2)])).toEqual([span(1, 3)])
  })

  it('stretches a span that straddles the edit', () => {
    const before = words('a b c d e')
    const after = words('a b X Y e')
    expect(shiftSpans(before, after, [span(1, 3)])).toEqual([span(1, 4)])
  })

  it('drops a span whose words were all deleted', () => {
    const before = words('a b c d')
    const after = words('a d')
    expect(shiftSpans(before, after, [span(1, 3)])).toEqual([])
  })

  it('handles typing at the very end without touching earlier spans', () => {
    const before = words('a b')
    const after = words('a b c')
    expect(shiftSpans(before, after, [span(1, 2)])).toEqual([span(1, 2)])
  })

  it('handles the text becoming empty', () => {
    expect(shiftSpans(words('a b'), [], [span(0, 2)])).toEqual([])
  })
})

describe('shiftSpans with several edits at once (paste)', () => {
  it('handles two distant corrections without merging the spans between them', () => {
    const before = words(
      'Diagnose Leisten Hernie rechts neue Zeile Antibiose mit Cefuroxin Milligramm',
    )
    const after = words(
      'Diagnose Leistenhernie rechts neue Zeile Antibiose mit Cefuroxim Milligramm',
    )
    const spans = [
      span(1, 3, 'diagnosis'),
      span(4, 6, 'newline'),
      span(8, 9, 'drug'),
      span(9, 10, 'unit'),
    ]
    expect(shiftSpans(before, after, spans)).toEqual([
      span(1, 2, 'diagnosis'),
      span(3, 5, 'newline'),
      span(7, 8, 'drug'),
      span(8, 9, 'unit'),
    ])
  })

  it('does not let an inserted word join the span before it', () => {
    const before = words('a b c')
    const after = words('a b X c')
    expect(shiftSpans(before, after, [span(0, 2), span(2, 3)])).toEqual([span(0, 2), span(3, 4)])
  })

  it('stretches spans over a complete rewrite instead of losing them silently', () => {
    const before = words('a b c')
    const after = words('x y')
    expect(shiftSpans(before, after, [span(0, 1), span(1, 3)])).toEqual([span(0, 2), span(0, 2)])
  })
})
