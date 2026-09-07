import { spawn } from 'node:child_process'
import { config } from '../config.ts'

/** Sample rate the decoded stream is resampled to; level statistics do not depend on it. */
const DECODE_RATE = 16000

export class FfmpegUnavailableError extends Error {
  constructor() {
    super('ffmpeg not found; install ffmpeg (or set FFMPEG_PATH) to analyze mp3/m4a levels')
  }
}

/** Decodes any ffmpeg-readable file to mono 32-bit float samples. */
export function decodeWithFfmpeg(
  filePath: string,
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
    const out: Buffer[] = []
    let err = ''
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => (err += chunk.toString()))
    child.on('error', (e: NodeJS.ErrnoException) => {
      reject(e.code === 'ENOENT' ? new FfmpegUnavailableError() : e)
    })
    child.on('close', (code) => {
      if (code !== 0)
        return reject(new Error(`ffmpeg failed: ${err.trim() || `exit code ${code}`}`))
      const raw = Buffer.concat(out)
      // Copy into a fresh ArrayBuffer so the Float32Array view is 4-byte aligned.
      const aligned = new ArrayBuffer(raw.length - (raw.length % 4))
      new Uint8Array(aligned).set(raw.subarray(0, aligned.byteLength))
      resolve({ samples: new Float32Array(aligned), sampleRate: DECODE_RATE })
    })
  })
}
