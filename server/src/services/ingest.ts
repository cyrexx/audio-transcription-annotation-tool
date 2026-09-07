import { rm } from 'node:fs/promises'
import path from 'node:path'
import {
  routeByDuration,
  type AudioUploadResult,
  type PairingState,
  type TranscriptImportReport,
} from 'shared'
import { analyzeAudio, MIME_TYPES, UnsupportedAudioError } from '../audio/analyze.ts'
import { config } from '../config.ts'
import { prisma } from '../db.ts'
import { HttpError } from '../errors.ts'
import { MalformedTranscriptError, parseTranscriptJson } from '../ingest/transcriptParser.ts'
import { link } from './items.ts'

export interface StoredUpload {
  /** Absolute path of the file multer wrote into the storage directory. */
  path: string
  originalName: string
  size: number
}

/** Validates and registers one uploaded file; removes it from disk when it is rejected. */
export async function ingestAudio(file: StoredUpload): Promise<AudioUploadResult> {
  try {
    return await registerAudio(file)
  } catch (e) {
    await rm(file.path, { force: true })
    throw e
  }
}

async function registerAudio(file: StoredUpload): Promise<AudioUploadResult> {
  const filename = path.basename(file.originalName)
  const existing = await prisma.item.findUnique({ where: { filename } })
  if (existing) throw new HttpError(409, `An audio file named ${filename} was already uploaded`)

  let facts
  try {
    facts = await analyzeAudio(file.path)
  } catch (e) {
    if (e instanceof UnsupportedAudioError) throw new HttpError(415, e.message)
    throw e
  }
  const waiting = await prisma.transcript.findFirst({
    where: { filename, item: null },
    orderBy: { createdAt: 'asc' },
  })
  const item = await prisma.item.create({
    data: {
      filename,
      storagePath: path.relative(config.storageDir, file.path),
      mimeType: MIME_TYPES[facts.kind],
      sizeBytes: file.size,
      status: routeByDuration(facts.durationSec),
      durationSec: facts.durationSec,
      sampleRate: facts.sampleRate,
      channels: facts.channels,
      bitDepth: facts.bitDepth,
      container: facts.container,
      codec: facts.codec,
      metadata: facts.metadata,
      rmsDbfs: facts.levels?.rmsDbfs,
      peakDbfs: facts.levels?.peakDbfs,
      noiseFloorDbfs: facts.levels?.noiseFloorDbfs,
      snrDb: facts.levels?.snrDb,
      levelsError: facts.levelsError,
    },
  })
  if (waiting) await link(item.id, waiting)

  return {
    itemId: item.id,
    filename,
    durationSec: item.durationSec,
    status: item.status,
    pairedTranscriptId: waiting?.id ?? null,
  }
}

/** Imports a transcript file; each row is accepted, paired when possible, or reported. */
export async function importTranscripts(text: string): Promise<TranscriptImportReport> {
  let parsed
  try {
    parsed = parseTranscriptJson(text)
  } catch (e) {
    if (e instanceof MalformedTranscriptError) throw new HttpError(400, e.message)
    throw e
  }
  const report: TranscriptImportReport = { accepted: [], rejected: [...parsed.rejected] }

  for (const row of parsed.rows) {
    const known = await prisma.transcript.findFirst({ where: { path: row.path } })
    if (known) {
      report.rejected.push({
        index: row.index,
        path: row.path,
        reason: 'Duplicate path, already imported earlier',
      })
      continue
    }
    const transcript = await prisma.transcript.create({
      data: { path: row.path, filename: row.filename, label: row.label, source: 'FILE' },
    })
    const item = await prisma.item.findFirst({
      where: { filename: row.filename, transcriptId: null },
    })
    if (item) await link(item.id, transcript)
    report.accepted.push({
      transcriptId: transcript.id,
      path: row.path,
      pairedItemId: item?.id ?? null,
    })
  }

  report.rejected.sort((a, b) => a.index - b.index)
  return report
}

export async function pairingState(): Promise<PairingState> {
  const [items, transcripts] = await Promise.all([
    prisma.item.findMany({ where: { transcriptId: null }, orderBy: { filename: 'asc' } }),
    prisma.transcript.findMany({ where: { item: null }, orderBy: { createdAt: 'asc' } }),
  ])
  return {
    items: items.map((i) => ({ id: i.id, filename: i.filename, durationSec: i.durationSec })),
    transcripts: transcripts.map((t) => ({
      id: t.id,
      path: t.path,
      filename: t.filename,
      preview: t.label.length > 80 ? `${t.label.slice(0, 80)}…` : t.label,
    })),
  }
}
