import { spawn } from 'node:child_process'
import { config } from '../config.ts'

/** Sample rate the decoded stream is resampled to; level statistics do not depend on it. */
const DECODE_RATE = 16000

export class FfmpegUnavailableError extends Error {
  constructor() {
    super('ffmpeg not found; install ffmpeg (or set FFMPEG_PATH) to analyze mp3/m4a levels')
  }
}

/**
 * Decodes any ffmpeg-readable file to mono 32-bit float samples. The output buffer is sized from
 * the duration the header announced, so the decode holds one copy of the audio and a stream that
 * keeps going past that size is cut off instead of growing without bound.
 */
export function decodeWithFfmpeg(
  filePath: string,
  expectedSec: number,
): Promise<{ samples: Float32Array; sampleRate: number }> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v',
      'error',
      '-i',
      filePath,
      '-f',
      'f32le',
      '-ac',
      '1',
      '-ar',
      String(DECODE_RATE),
      '-',
    ]
    const child = spawn(config.ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const capacity = new ArrayBuffer(Math.ceil((expectedSec + 1) * DECODE_RATE) * 4)
    const bytes = new Uint8Array(capacity)
    let written = 0
    let err = ''
    child.stdout.on('data', (chunk: Buffer) => {
      if (written + chunk.length > bytes.length) {
        err = 'decoded audio is longer than the header announced'
        child.kill()
        return
      }
      bytes.set(chunk, written)
      written += chunk.length
    })
    child.stderr.on('data', (chunk: Buffer) => (err += chunk.toString()))
    child.on('error', (e: NodeJS.ErrnoException) => {
      reject(e.code === 'ENOENT' ? new FfmpegUnavailableError() : e)
    })
    child.on('close', (code) => {
      if (code !== 0)
        return reject(new Error(`ffmpeg failed: ${err.trim() || `exit code ${code}`}`))
      resolve({
        samples: new Float32Array(capacity, 0, Math.floor(written / 4)),
        sampleRate: DECODE_RATE,
      })
    })
  })
}
