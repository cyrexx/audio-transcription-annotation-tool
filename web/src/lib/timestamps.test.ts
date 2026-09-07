import { describe, expect, it } from 'vitest'
import { estimateTokenTime } from './timestamps.ts'

describe('estimateTokenTime', () => {
  it('maps character position proportionally onto the duration', () => {
    expect(estimateTokenTime(0, 100, 30)).toBe(0)
    expect(estimateTokenTime(50, 100, 30)).toBe(15)
    expect(estimateTokenTime(100, 100, 30)).toBe(30)
  })

  it('does not divide by zero for empty text', () => {
    expect(estimateTokenTime(0, 0, 30)).toBe(0)
  })
})
