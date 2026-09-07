import { tokenize, type DistanceEstimate, type LevelAnalysis, type Span } from 'shared'
import type { Item, Span as SpanRow, Transcript } from '../../prisma/generated/client.ts'
import { prisma } from '../db.ts'
import { levelsOf, recordingConditions, toSpan } from './items.ts'

/** One JSONL line of the gold standard. */
export interface ExportRecord {
  itemId: string
  audio: { filename: string; path: string; mimeType: string }
  status: string
  annotator: string | null
  originalTranscript: string
  correctedTranscript: string
  /** Token ranges plus character offsets and the covered text, so consumers need no tokenizer. */
  spans: (Span & { charStart: number; charEnd: number; text: string })[]
  recordingConditions: {
    durationSec: number
    sampleRate: number | null
    channels: number | null
    bitDepth: number | null
    container: string | null
    codec: string | null
    metadata: Record<string, string>
    speechRateWpm: number | null
    speechRateSource: 'annotator' | 'derived' | null
    distance: DistanceEstimate | null
    distanceSource: 'annotator' | 'derived' | null
    levels: LevelAnalysis | null
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
  const conditions = recordingConditions(item)
  return {
    itemId: item.id,
    audio: { filename: item.filename, path: item.storagePath, mimeType: item.mimeType },
    status: item.status,
    annotator: item.annotator,
    originalTranscript: item.transcript.label,
    correctedTranscript: corrected,
    spans: item.spans.map((row) => {
      const span = toSpan(row)
      const charStart = tokens[span.start].start
      const charEnd = tokens[span.end - 1].end
      return { ...span, charStart, charEnd, text: corrected.slice(charStart, charEnd) }
    }),
    recordingConditions: {
      durationSec: item.durationSec,
      sampleRate: item.sampleRate,
      channels: item.channels,
      bitDepth: item.bitDepth,
      container: item.container,
      codec: item.codec,
      metadata: conditions.metadata,
      ...pick(
        item.speechRateWpmOverride,
        conditions.speechRateWpm,
        'speechRateWpm',
        'speechRateSource',
      ),
      ...pick(item.distanceOverride, conditions.distanceEstimate, 'distance', 'distanceSource'),
      levels: levelsOf(item),
    },
    exportedAt: new Date().toISOString(),
  }
}

/** The annotator's override wins over the derived suggestion, and the record says which it was. */
function pick<T, K extends string, S extends string>(
  override: T | null,
  derived: T | null,
  key: K,
  sourceKey: S,
) {
  const value = override ?? derived
  const source = override !== null ? 'annotator' : derived !== null ? 'derived' : null
  return { [key]: value, [sourceKey]: source } as Record<K, T | null> &
    Record<S, 'annotator' | 'derived' | null>
}
