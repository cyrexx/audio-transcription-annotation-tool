import {
  estimateDistance,
  finalizeSpan,
  sameTypeAndRange,
  speechRateWpm,
  tokenCount,
  tokenize,
  type AnnotationUpdate,
  type ItemDetail,
  type ItemSummary,
  type LevelAnalysis,
  type RecordingConditions,
  type Span,
} from 'shared'
import type { Item, Span as SpanRow, Transcript } from '../../prisma/generated/client.ts'
import { prisma } from '../db.ts'
import { HttpError, notFound } from '../errors.ts'

type ItemWithRelations = Item & { transcript: Transcript | null; spans: SpanRow[] }

const withRelations = {
  transcript: true,
  spans: { orderBy: [{ start: 'asc' as const }, { end: 'asc' as const }] },
}

export async function listItems(): Promise<ItemSummary[]> {
  const items = await prisma.item.findMany({ orderBy: { createdAt: 'asc' } })
  return items.map(toSummary)
}

export async function getItem(id: string): Promise<ItemDetail> {
  const item = await prisma.item.findUnique({ where: { id }, include: withRelations })
  if (!item) throw notFound('Item')
  return toDetail(item)
}

export async function getItemRow(id: string): Promise<Item> {
  const item = await prisma.item.findUnique({ where: { id } })
  if (!item) throw notFound('Item')
  return item
}

/** Replaces corrected text, spans and overrides in one transaction. */
export async function updateAnnotation(id: string, update: AnnotationUpdate): Promise<ItemDetail> {
  const item = await getItemRow(id)
  if (item.status === 'AUTO_REJECTED')
    throw new HttpError(409, 'Auto-rejected items are not annotated')
  if (!item.transcriptId) throw new HttpError(409, 'Item has no transcript to annotate yet')

  const words = tokenize(update.correctedText)
  const tokens = words.length
  update.spans.forEach((span, i) => {
    if (span.end > tokens) {
      throw new HttpError(
        400,
        `spans.${i}: ends at token ${span.end} but the text has ${tokens} tokens`,
      )
    }
    if (update.spans.some((other, j) => j < i && sameTypeAndRange(span, other))) {
      const covered = words
        .slice(span.start, span.end)
        .map((w) => w.text)
        .join(' ')
      throw new HttpError(400, `spans.${i}: a second ${span.type} span on "${covered}"`)
    }
  })

  const status = update.status ?? (item.status === 'PENDING' ? 'IN_PROGRESS' : item.status)
  await prisma.$transaction([
    prisma.item.update({
      where: { id },
      data: {
        correctedText: update.correctedText,
        speechRateWpmOverride: update.speechRateWpmOverride,
        distanceOverride: update.distanceOverride,
        annotator: update.annotator,
        status,
      },
    }),
    prisma.span.deleteMany({ where: { itemId: id } }),
    prisma.span.createMany({
      data: update.spans.map(finalizeSpan).map((s) => ({ itemId: id, ...s })),
    }),
  ])
  return getItem(id)
}

/** Stores a transcript typed into the UI and pairs it with the item. */
export async function pasteTranscript(id: string, label: string): Promise<void> {
  const item = await getItemRow(id)
  if (item.transcriptId) throw new HttpError(409, 'Item already has a transcript; unpair it first')
  const transcript = await prisma.transcript.create({
    data: { path: item.filename, filename: item.filename, label, source: 'PASTE' },
  })
  await link(item.id, transcript)
}

export async function pairItem(id: string, transcriptId: string): Promise<void> {
  const item = await getItemRow(id)
  if (item.transcriptId) throw new HttpError(409, 'Item already has a transcript')
  const transcript = await prisma.transcript.findUnique({
    where: { id: transcriptId },
    include: { item: true },
  })
  if (!transcript) throw notFound('Transcript')
  if (transcript.item)
    throw new HttpError(409, `Transcript is already paired with ${transcript.item.filename}`)
  await link(item.id, transcript)
}

/** Detaches the transcript; corrected text and spans referred to it, so they go too. */
export async function unpairItem(id: string): Promise<void> {
  const item = await getItemRow(id)
  if (!item.transcriptId) throw new HttpError(409, 'Item has no transcript')
  await prisma.$transaction([
    prisma.span.deleteMany({ where: { itemId: id } }),
    prisma.item.update({
      where: { id },
      data: {
        transcriptId: null,
        correctedText: null,
        status: item.status === 'AUTO_REJECTED' ? 'AUTO_REJECTED' : 'PENDING',
      },
    }),
  ])
}

/** The transcript label is the annotator's starting point, so pairing copies it. */
export function link(itemId: string, transcript: Transcript) {
  return prisma.item.update({
    where: { id: itemId },
    data: { transcriptId: transcript.id, correctedText: transcript.label },
  })
}

function toSummary(item: Item): ItemSummary {
  return {
    id: item.id,
    filename: item.filename,
    durationSec: item.durationSec,
    status: item.status,
    annotator: item.annotator,
    hasTranscript: item.transcriptId !== null,
    updatedAt: item.updatedAt.toISOString(),
  }
}

function toDetail(item: ItemWithRelations): ItemDetail {
  return {
    ...toSummary(item),
    transcript: item.transcript
      ? { id: item.transcript.id, path: item.transcript.path, source: item.transcript.source }
      : null,
    originalText: item.transcript?.label ?? null,
    correctedText: item.correctedText,
    spans: item.spans.map(toSpan),
    speechRateWpmOverride: item.speechRateWpmOverride,
    distanceOverride: item.distanceOverride,
    recording: recordingConditions(item),
  }
}

export function toSpan(row: SpanRow): Span {
  return {
    id: row.id,
    type: row.type,
    start: row.start,
    end: row.end,
    attributes: row.attributes,
  } as Span
}

export function levelsOf(item: Item): LevelAnalysis | null {
  if (
    item.rmsDbfs === null ||
    item.peakDbfs === null ||
    item.noiseFloorDbfs === null ||
    item.snrDb === null
  ) {
    return null
  }
  return {
    rmsDbfs: item.rmsDbfs,
    peakDbfs: item.peakDbfs,
    noiseFloorDbfs: item.noiseFloorDbfs,
    snrDb: item.snrDb,
  }
}

export function recordingConditions(item: Item): RecordingConditions {
  const levels = levelsOf(item)
  return {
    durationSec: item.durationSec,
    sampleRate: item.sampleRate,
    channels: item.channels,
    bitDepth: item.bitDepth,
    container: item.container,
    codec: item.codec,
    metadata: item.metadata as Record<string, string>,
    levels,
    levelsError: item.levelsError,
    speechRateWpm:
      item.correctedText === null
        ? null
        : speechRateWpm(tokenCount(item.correctedText), item.durationSec),
    distanceEstimate: levels ? estimateDistance(levels) : null,
  }
}
