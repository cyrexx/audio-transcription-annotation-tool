import { describe, expect, it } from 'vitest'
import { tokenCount, tokenize } from './tokenize.ts'

describe('tokenize', () => {
  it('splits on any whitespace and keeps punctuation attached', () => {
    expect(tokenize('Cefuroxim 1500 mg,\n neue  Zeile').map((t) => t.text)).toEqual([
      'Cefuroxim',
      '1500',
      'mg,',
      'neue',
      'Zeile',
    ])
  })

  it('reports character offsets into the original text', () => {
    expect(tokenize('  ab  cd')).toEqual([
      { text: 'ab', start: 2, end: 4 },
      { text: 'cd', start: 6, end: 8 },
    ])
  })

  it('returns no tokens for blank text', () => {
    expect(tokenize('')).toEqual([])
    expect(tokenize('  \n\t ')).toEqual([])
    expect(tokenCount('   ')).toBe(0)
  })
})
