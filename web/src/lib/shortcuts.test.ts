import { describe, expect, it } from 'vitest'
import { matchShortcut, matchSpanType } from './shortcuts.ts'

const key = (code: string, mods: Partial<KeyboardEvent> = {}) =>
  ({
    code,
    altKey: false,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    ...mods,
  }) as KeyboardEvent

describe('matchShortcut', () => {
  it('matches on the physical key plus exact modifiers', () => {
    expect(matchShortcut(key('KeyK', { altKey: true }))).toBe('togglePlay')
    expect(matchShortcut(key('KeyJ', { altKey: true }))).toBe('back')
    expect(matchShortcut(key('KeyJ', { altKey: true, shiftKey: true }))).toBe('backFar')
    expect(matchShortcut(key('KeyS', { ctrlKey: true }))).toBe('save')
  })

  it('ignores combinations that include the Command key', () => {
    expect(matchShortcut(key('KeyK', { altKey: true, metaKey: true }))).toBeNull()
    expect(matchShortcut(key('KeyS', { ctrlKey: true, metaKey: true }))).toBeNull()
    expect(matchSpanType(key('Digit1', { altKey: true, metaKey: true }))).toBeNull()
  })

  it('ignores plain typing so the shortcuts are safe inside the transcript editor', () => {
    expect(matchShortcut(key('KeyK'))).toBeNull()
    expect(matchShortcut(key('KeyJ', { shiftKey: true }))).toBeNull()
    expect(matchShortcut(key('Comma'))).toBeNull()
  })
})

describe('matchSpanType', () => {
  it('maps Alt+1 to Alt+6 onto the type buttons', () => {
    expect(matchSpanType(key('Digit1', { altKey: true }))).toBe(0)
    expect(matchSpanType(key('Digit6', { altKey: true }))).toBe(5)
  })

  it('leaves plain digits alone so values can be typed', () => {
    expect(matchSpanType(key('Digit1'))).toBeNull()
    expect(matchSpanType(key('Digit7', { altKey: true }))).toBeNull()
    expect(matchSpanType(key('Digit1', { altKey: true, shiftKey: true }))).toBeNull()
  })
})
