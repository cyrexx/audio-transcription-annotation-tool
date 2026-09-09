/**
 * Builds WAV files in memory for tests, so the repo needs no binary fixtures.
 */
export interface SynthWavOptions {
  seconds: number
  sampleRate?: number
  channels?: number
  /** 8, 16, 24 or 32 for integer PCM; use `float: true` with 32 for IEEE float. */
  bitDepth?: number
  float?: boolean
  /** Sample generator in the range -1..1; defaults to silence. */
  signal?: (t: number, channel: number) => number
  bext?: { description?: string; originator?: string; originationDate?: string }
  /** LIST INFO tags, for example { IART: 'Dr. Müller', ISFT: 'Recorder' }. */
  info?: Record<string, string>
}

export const sine =
  (freq: number, amplitude = 1) =>
  (t: number) =>
    amplitude * Math.sin(2 * Math.PI * freq * t)

export function synthWav(opts: SynthWavOptions): Buffer {
  const sampleRate = opts.sampleRate ?? 16000
  const channels = opts.channels ?? 1
  const bitDepth = opts.bitDepth ?? (opts.float ? 32 : 16)
  const bytesPerSample = bitDepth / 8
  const frames = Math.round(opts.seconds * sampleRate)
  const signal = opts.signal ?? (() => 0)

  const data = Buffer.alloc(frames * channels * bytesPerSample)
  let off = 0
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const x = Math.max(-1, Math.min(1, signal(i / sampleRate, c)))
      if (opts.float) data.writeFloatLE(x, off)
      else if (bitDepth === 8) data.writeUInt8(Math.round(x * 127) + 128, off)
      else if (bitDepth === 16) data.writeInt16LE(Math.round(x * 32767), off)
      else if (bitDepth === 24) data.writeIntLE(Math.round(x * 8388607), off, 3)
      else data.writeInt32LE(Math.round(x * 2147483647), off)
      off += bytesPerSample
    }
  }

  const fmt = Buffer.alloc(16)
  fmt.writeUInt16LE(opts.float ? 3 : 1, 0)
  fmt.writeUInt16LE(channels, 2)
  fmt.writeUInt32LE(sampleRate, 4)
  fmt.writeUInt32LE(sampleRate * channels * bytesPerSample, 8)
  fmt.writeUInt16LE(channels * bytesPerSample, 12)
  fmt.writeUInt16LE(bitDepth, 14)

  const chunks = [chunk('fmt ', fmt)]
  if (opts.bext) chunks.push(chunk('bext', bextBody(opts.bext)))
  if (opts.info) chunks.push(chunk('LIST', listInfoBody(opts.info)))
  chunks.push(chunk('data', data))

  const body = Buffer.concat(chunks)
  const header = Buffer.alloc(12)
  header.write('RIFF', 0, 'latin1')
  header.writeUInt32LE(4 + body.length, 4)
  header.write('WAVE', 8, 'latin1')
  return Buffer.concat([header, body])
}

function chunk(id: string, body: Buffer): Buffer {
  const header = Buffer.alloc(8)
  header.write(id, 0, 'latin1')
  header.writeUInt32LE(body.length, 4)
  const pad = body.length % 2 === 1 ? Buffer.alloc(1) : Buffer.alloc(0)
  return Buffer.concat([header, body, pad])
}

function bextBody(bext: NonNullable<SynthWavOptions['bext']>): Buffer {
  const body = Buffer.alloc(602)
  body.write(bext.description ?? '', 0, 256, 'ascii')
  body.write(bext.originator ?? '', 256, 32, 'ascii')
  body.write(bext.originationDate ?? '', 320, 10, 'ascii')
  body.writeUInt16LE(1, 346)
  return body
}

function listInfoBody(info: Record<string, string>): Buffer {
  const parts: Buffer[] = [Buffer.from('INFO', 'latin1')]
  for (const [id, value] of Object.entries(info)) {
    parts.push(chunk(id, Buffer.from(`${value}\0`, 'utf8')))
  }
  return Buffer.concat(parts)
}
