import { readFile } from 'node:fs/promises'
import { parseFile, type IAudioMetadata } from 'music-metadata'
import type { LevelAnalysis } from 'shared'
import { decodeWithFfmpeg } from './ffmpeg.ts'
import { analyzeLevels } from './levels.ts'
import { decodeWav } from './wav.ts'

export type AudioKind = 'wav' | 'mp3' | 'm4a'

export const AUDIO_EXTENSIONS: Record<string, AudioKind> = {
  '.wav': 'wav',
  '.mp3': 'mp3',
  '.m4a': 'm4a',
}

export const MIME_TYPES: Record<AudioKind, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
}

export interface AudioFacts {
  kind: AudioKind
  durationSec: number
  sampleRate: number | null
  channels: number | null
  bitDepth: number | null
  container: string | null
  codec: string | null
  metadata: Record<string, string>
  levels: LevelAnalysis | null
  levelsError: string | null
}

export class UnsupportedAudioError extends Error {}

/** Headers outside this range are crafted or broken; real recorders sit between 8 and 192 kHz. */
const MIN_SAMPLE_RATE = 1000
const MAX_SAMPLE_RATE = 384000
/** Level analysis decodes the whole recording into memory; dictations are minutes, not hours. */
const MAX_ANALYSIS_SEC = 60 * 60
/** Recorder metadata values are shown in a panel; anything longer is not metadata. */
const MAX_METADATA_CHARS = 1000
/** A recorder writes a handful of INFO tags; a file with thousands is not carrying metadata. */
const MAX_METADATA_ENTRIES = 100

/**
 * Reads header facts and signal levels from a file on disk. music-metadata picks its parser by
 * the file extension, so a file whose content does not match its extension fails to parse and
 * is rejected here as unreadable.
 */
export async function analyzeAudio(filePath: string): Promise<AudioFacts> {
  let meta: IAudioMetadata | undefined
  try {
    meta = await parseFile(filePath, { duration: true })
  } catch {
    // reported below, together with files music-metadata reads but does not recognise
  }
  const kind = kindOf(meta?.format.container)
  if (!meta || !kind) {
    const detail = meta?.format.container ? ` (detected ${meta.format.container})` : ''
    throw new UnsupportedAudioError(`File is not a readable WAV, MP3 or M4A file${detail}`)
  }
  const durationSec = meta.format.duration
  if (!durationSec || !Number.isFinite(durationSec)) {
    throw new UnsupportedAudioError('Could not determine the audio duration')
  }
  // MP4 stores the rate in 16.16 fixed point, so 96 kHz AAC reads as 0: unknown, not invalid.
  const sampleRate = meta.format.sampleRate || null
  if (sampleRate !== null && (sampleRate < MIN_SAMPLE_RATE || sampleRate > MAX_SAMPLE_RATE)) {
    throw new UnsupportedAudioError(`Unsupported sample rate: ${sampleRate} Hz`)
  }

  const { levels, levelsError } = await measureLevels(filePath, kind, durationSec)
  return {
    kind,
    durationSec,
    sampleRate,
    channels: meta.format.numberOfChannels ?? null,
    // Lossy containers may carry a nominal sample size (AAC in MP4 says 16); it means nothing.
    bitDepth: meta.format.lossless ? (meta.format.bitsPerSample ?? null) : null,
    container: meta.format.container ?? null,
    codec: meta.format.codec ?? null,
    metadata: recorderMetadata(meta),
    levels,
    levelsError,
  }
}

function kindOf(container: string | undefined): AudioKind | null {
  if (container === 'WAVE') return 'wav'
  if (container === 'MPEG') return 'mp3'
  if (container && /M4A|mp4|isom/i.test(container)) return 'm4a'
  return null
}

async function measureLevels(filePath: string, kind: AudioKind, durationSec: number) {
  if (durationSec > MAX_ANALYSIS_SEC) {
    return {
      levels: null,
      levelsError: 'Recording is longer than 60 minutes; level analysis skipped',
    }
  }
  try {
    const pcm =
      kind === 'wav'
        ? decodeWav(await readFile(filePath))
        : await decodeWithFfmpeg(filePath, durationSec)
    return { levels: analyzeLevels(pcm.samples, pcm.sampleRate), levelsError: null }
  } catch (e) {
    return { levels: null, levelsError: (e as Error).message }
  }
}

/** bext and LIST INFO chunks, which music-metadata files under the `exif` native tags. */
function recorderMetadata(meta: IAudioMetadata): Record<string, string> {
  const out: Record<string, string> = {}
  for (const tag of meta.native.exif ?? []) {
    if (Object.keys(out).length >= MAX_METADATA_ENTRIES) break
    const value = displayValue(tag.value)
    if (value) out[tag.id] = value
  }
  return out
}

function displayValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const text = value.trim()
    return text.length > MAX_METADATA_CHARS ? `${text.slice(0, MAX_METADATA_CHARS)}…` : text || null
  }
  if (typeof value === 'number') return value === 0 ? null : String(value)
  if (value instanceof Uint8Array) {
    return value.some((b) => b !== 0) ? Buffer.from(value).toString('hex') : null
  }
  return null
}
