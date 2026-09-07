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

/** Reads header facts and signal levels from a file on disk. */
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
  if (!durationSec) throw new UnsupportedAudioError('Could not determine the audio duration')

  const { levels, levelsError } = await measureLevels(filePath, kind)
  return {
    kind,
    durationSec,
    sampleRate: meta.format.sampleRate ?? null,
    channels: meta.format.numberOfChannels ?? null,
    bitDepth: meta.format.bitsPerSample ?? null,
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

async function measureLevels(filePath: string, kind: AudioKind) {
  try {
    const pcm =
      kind === 'wav' ? decodeWav(await readFile(filePath)) : await decodeWithFfmpeg(filePath)
    return { levels: analyzeLevels(pcm.samples, pcm.sampleRate), levelsError: null }
  } catch (e) {
    return { levels: null, levelsError: (e as Error).message }
  }
}

/** bext and LIST INFO chunks, which music-metadata files under the `exif` native tags. */
function recorderMetadata(meta: IAudioMetadata): Record<string, string> {
  const out: Record<string, string> = {}
  for (const tag of meta.native.exif ?? []) {
    const value = displayValue(tag.value)
    if (value) out[tag.id] = value
  }
  return out
}

function displayValue(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number') return value === 0 ? null : String(value)
  if (value instanceof Uint8Array) {
    return value.some((b) => b !== 0) ? Buffer.from(value).toString('hex') : null
  }
  return null
}
