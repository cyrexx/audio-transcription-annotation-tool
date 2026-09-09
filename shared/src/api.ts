import { z } from 'zod'
import { spanInputSchema, type Span } from './annotation.ts'
import { DISTANCE_ESTIMATES, type DistanceEstimate, type LevelAnalysis } from './conditions.ts'
import type { ItemStatus } from './routing.ts'

/** One row of the work queue. */
export interface ItemSummary {
  id: string
  filename: string
  durationSec: number
  status: ItemStatus
  annotator: string | null
  hasTranscript: boolean
  updatedAt: string
}

export interface RecordingConditions {
  durationSec: number
  sampleRate: number | null
  channels: number | null
  /** Null for lossy formats, which have no fixed bit depth. */
  bitDepth: number | null
  container: string | null
  codec: string | null
  /** bext and LIST INFO fields as written by the recorder, empty when absent. */
  metadata: Record<string, string>
  levels: LevelAnalysis | null
  /** Why `levels` is null, for example a missing ffmpeg. */
  levelsError: string | null
  /** Derived suggestion; the annotator's override lives on the item. */
  speechRateWpm: number | null
  /** Derived suggestion; the annotator's override lives on the item. */
  distanceEstimate: DistanceEstimate | null
}

export interface ItemDetail extends ItemSummary {
  transcript: { id: string; path: string; source: 'FILE' | 'PASTE' } | null
  /** Immutable model output. */
  originalText: string | null
  correctedText: string | null
  spans: Span[]
  speechRateWpmOverride: number | null
  distanceOverride: DistanceEstimate | null
  recording: RecordingConditions
}

export const annotationUpdateSchema = z.object({
  correctedText: z.string(),
  spans: z.array(spanInputSchema),
  speechRateWpmOverride: z.number().min(0).nullable(),
  distanceOverride: z.enum(DISTANCE_ESTIMATES).nullable(),
  annotator: z.string().trim().max(100).nullable(),
  status: z.enum(['IN_PROGRESS', 'DONE']).optional(),
})
export type AnnotationUpdate = z.infer<typeof annotationUpdateSchema>

export interface AudioUploadResult {
  itemId: string
  filename: string
  durationSec: number
  status: ItemStatus
  /** Set when a waiting transcript with the same filename was paired automatically. */
  pairedTranscriptId: string | null
}

export interface TranscriptImportReport {
  accepted: { transcriptId: string; path: string; pairedItemId: string | null }[]
  /** `row` is 1-based, as a person counts rows in the file. */
  rejected: { row: number; path: string | null; reason: string }[]
}

/** Both sides of the pairing view: what has no partner yet. */
export interface PairingState {
  items: { id: string; filename: string; durationSec: number }[]
  transcripts: { id: string; path: string; filename: string; preview: string }[]
}

export interface ApiError {
  error: string
}
