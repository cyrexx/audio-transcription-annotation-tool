export type PlayerAction =
  | 'togglePlay'
  | 'back'
  | 'forward'
  | 'backFar'
  | 'forwardFar'
  | 'slower'
  | 'faster'
  | 'toggleMode'
  | 'save'

export interface Shortcut {
  action: PlayerAction
  /** Physical key, so the binding is the same on German and US layouts. */
  code: string
  alt: boolean
  shift: boolean
  ctrl: boolean
  label: string
  keys: string
}

const define = (action: PlayerAction, keys: string, code: string, label: string): Shortcut => ({
  action,
  code,
  alt: keys.includes('Alt'),
  shift: keys.includes('Shift'),
  ctrl: keys.includes('Ctrl'),
  label,
  keys,
})

export const JUMP_SEC = 3
export const JUMP_FAR_SEC = 10

/** All shortcuts use Alt (Option) so they also work while typing in the transcript. */
export const SHORTCUTS: Shortcut[] = [
  define('togglePlay', 'Alt+K', 'KeyK', 'Play / pause'),
  define('back', 'Alt+J', 'KeyJ', `Jump back ${JUMP_SEC} s`),
  define('forward', 'Alt+L', 'KeyL', `Jump forward ${JUMP_SEC} s`),
  define('backFar', 'Alt+Shift+J', 'KeyJ', `Jump back ${JUMP_FAR_SEC} s`),
  define('forwardFar', 'Alt+Shift+L', 'KeyL', `Jump forward ${JUMP_FAR_SEC} s`),
  define('slower', 'Alt+,', 'Comma', 'Slower'),
  define('faster', 'Alt+.', 'Period', 'Faster'),
  define('toggleMode', 'Alt+E', 'KeyE', 'Switch between edit and annotate'),
  define('save', 'Ctrl+S', 'KeyS', 'Save now'),
]

export function matchShortcut(event: KeyboardEvent): PlayerAction | null {
  const hit = SHORTCUTS.find(
    (s) =>
      s.code === event.code &&
      s.alt === event.altKey &&
      s.shift === event.shiftKey &&
      s.ctrl === event.ctrlKey,
  )
  return hit?.action ?? null
}
