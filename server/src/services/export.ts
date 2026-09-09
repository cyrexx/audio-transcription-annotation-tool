import { tokenize, type DistanceEstimate, type RecordingConditions, type Span } from 'shared'
import type { Item, Span as SpanRow, Transcript } from '../../prisma/generated/client.ts'
import { prisma } from '../db.ts'
import { recordingConditions, toSpan } from './items.ts'

/** Which of the two candidates the exported value came from. */
type ValueSource = 'annotator' | 'derived' | null

/** One JSONL line of the gold standard. */
export interface ExportRecord {
  itemId: string
  audio: {
    filename: string
    /** The `path` from the transcript file (or the filename for pasted text): what the pipeline knows. */
    sourcePath: string
    /** Where the bytes live, relative to the storage directory. */
    storagePath: string
    mimeType: string
  }
  status: string
  annotator: string | null
  originalTranscript: string
  correctedTranscript: string
  /** Token ranges plus character offsets and the covered text, so consumers need no tokenizer. */
  spans: (Omit<Span, 'id'> & { charStart: number; charEnd: number; text: string })[]
  /** Header facts and levels as read, plus the effective speech rate and distance with their source. */
  recordingConditions: Omit<
    RecordingConditions,
    'levelsError' | 'speechRateWpm' | 'distanceEstimate'
  > & {
    speechRateWpm: number | null
    speechRateSource: ValueSource
    distance: DistanceEstimate | null
    distanceSource: ValueSource
  }
  exportedAt: string
}

type Exportable = Item & { transcript: Transcript; spans: SpanRow[] }

export async function exportRecords(includeUnfinished: boolean): Promise<ExportRecord[]> {
  const items = await prisma.item.findMany({
    where: {
      transcriptId: { not: null },
      status: includeUnfinished ? { in: ['IN_PROGRESS', 'DONE'] } : 'DONE',
    },
    include: { transcript: true, spans: { orderBy: [{ start: 'asc' }, { end: 'asc' }] } },
    orderBy: { filename: 'asc' },
  })
  return items.map((item) => toExportRecord(item as Exportable))
}

export function toExportRecord(item: Exportable): ExportRecord {
  const corrected = item.correctedText ?? item.transcript.label
  const tokens = tokenize(corrected)
  const {
    levelsError: _levelsError,
    speechRateWpm,
    distanceEstimate,
    ...conditions
  } = recordingConditions(item)
  // Span ids change on every save (spans are replaced), so they are not part of the record.
  return {
    itemId: item.id,
    audio: {
      filename: item.filename,
      sourcePath: item.transcript.path,
      storagePath: item.storagePath,
      mimeType: item.mimeType,
    },
    status: item.status,
    annotator: item.annotator,
    originalTranscript: item.transcript.label,
    correctedTranscript: corrected,
    spans: item.spans.map((row) => {
      const { id: _id, ...span } = toSpan(row)
      const charStart = tokens[span.start].start
      const charEnd = tokens[span.end - 1].end
      return { ...span, charStart, charEnd, text: corrected.slice(charStart, charEnd) }
    }),
    recordingConditions: {
      ...conditions,
      // The annotator's override wins over the derived suggestion, and the record says which it was.
      speechRateWpm: item.speechRateWpmOverride ?? speechRateWpm,
      speechRateSource: sourceOf(item.speechRateWpmOverride, speechRateWpm),
      distance: item.distanceOverride ?? distanceEstimate,
      distanceSource: sourceOf(item.distanceOverride, distanceEstimate),
    },
    exportedAt: new Date().toISOString(),
  }
}

const sourceOf = (override: unknown, derived: unknown): ValueSource =>
  override !== null ? 'annotator' : derived !== null ? 'derived' : null
