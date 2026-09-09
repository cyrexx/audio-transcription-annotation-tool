/**
 * Parses the production transcript format: a JSON array of { path, label }.
 * Every row is either accepted or rejected with a reason; nothing is dropped silently.
 */
export interface TranscriptRow {
  /** 1-based position in the uploaded file, as a person counts rows. */
  row: number
  path: string
  filename: string
  label: string
}

export interface RejectedRow {
  row: number
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

  parsed.forEach((entry: unknown, i) => {
    const row = i + 1
    const reason = validate(entry)
    if (reason) {
      const path = isRecord(entry) && typeof entry.path === 'string' ? entry.path : null
      rejected.push({ row, path, reason })
      return
    }
    const { path, label } = entry as { path: string; label: string }
    const firstRow = seen.get(path)
    if (firstRow !== undefined) {
      rejected.push({ row, path, reason: `Duplicate path, first seen in row ${firstRow}` })
      return
    }
    seen.set(path, row)
    rows.push({ row, path, filename: basename(path), label })
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
