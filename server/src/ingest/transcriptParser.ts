/**
 * Parses the production transcript format: a JSON array of { path, label }.
 * Every row is either accepted or rejected with a reason; nothing is dropped silently.
 */
export interface TranscriptRow {
  index: number
  path: string
  filename: string
  label: string
}

export interface RejectedRow {
  index: number
  path: string | null
  reason: string
}

export interface ParsedTranscripts {
  rows: TranscriptRow[]
  rejected: RejectedRow[]
}

export class MalformedTranscriptError extends Error {}

/** Last segment of a path with either separator, which is what audio filenames are matched on. */
export function basename(p: string): string {
  return p.split(/[\\/]/).pop() ?? ''
}

export function parseTranscriptJson(text: string): ParsedTranscripts {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    throw new MalformedTranscriptError(`Malformed JSON: ${(e as Error).message}`)
  }
  if (!Array.isArray(parsed)) {
    throw new MalformedTranscriptError('Expected a JSON array of { "path", "label" } objects')
  }

  const rows: TranscriptRow[] = []
  const rejected: RejectedRow[] = []
  const seen = new Map<string, number>()

  parsed.forEach((entry: unknown, index) => {
    const reason = validate(entry)
    if (reason) {
      const path = isRecord(entry) && typeof entry.path === 'string' ? entry.path : null
      rejected.push({ index, path, reason })
      return
    }
    const { path, label } = entry as { path: string; label: string }
    const firstIndex = seen.get(path)
    if (firstIndex !== undefined) {
      rejected.push({ index, path, reason: `Duplicate path, first seen in row ${firstIndex}` })
      return
    }
    seen.set(path, index)
    rows.push({ index, path, filename: basename(path), label })
  })

  return { rows, rejected }
}

function validate(entry: unknown): string | null {
  if (!isRecord(entry)) return 'Row is not an object'
  if (typeof entry.path !== 'string' || entry.path.trim() === '') return 'Missing "path"'
  if (basename(entry.path) === '') return '"path" has no filename'
  if (typeof entry.label !== 'string') return 'Missing "label"'
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
