import { describe, expect, it } from 'vitest'
import { matchShortcut } from './shortcuts.ts'

const key = (code: string, mods: Partial<KeyboardEvent> = {}) =>
  ({ code, altKey: false, shiftKey: false, ctrlKey: false, ...mods }) as KeyboardEvent

describe('matchShortcut', () => {
  it('matches on the physical key plus exact modifiers', () => {
    expect(matchShortcut(key('KeyK', { altKey: true }))).toBe('togglePlay')
    expect(matchShortcut(key('KeyJ', { altKey: true }))).toBe('back')
    expect(matchShortcut(key('KeyJ', { altKey: true, shiftKey: true }))).toBe('backFar')
    expect(matchShortcut(key('KeyS', { ctrlKey: true }))).toBe('save')
  })

  it('ignores plain typing so the shortcuts are safe inside the transcript editor', () => {
    expect(matchShortcut(key('KeyK'))).toBeNull()
    expect(matchShortcut(key('KeyJ', { shiftKey: true }))).toBeNull()
    expect(matchShortcut(key('Comma'))).toBeNull()
  })
})
