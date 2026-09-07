export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds - m * 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}

export const STATUS_LABELS = {
  AUTO_REJECTED: 'Auto-rejected',
  PENDING: 'Pending',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
} as const
