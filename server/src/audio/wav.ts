/**
 * Minimal RIFF/WAVE PCM decoder: enough to get the samples out of what dictation
 * recorders write. Header facts come from music-metadata; this exists only because
 * the level analysis needs the actual samples.
 */
export interface WavPcm {
  sampleRate: number
  channels: number
  bitDepth: number
  /** Mono mix-down in the range -1..1. */
  samples: Float32Array
}

const FORMAT_PCM = 1
const FORMAT_FLOAT = 3
const FORMAT_EXTENSIBLE = 0xfffe

export function decodeWav(buf: Buffer): WavPcm {
  if (
    buf.length < 12 ||
    buf.toString('latin1', 0, 4) !== 'RIFF' ||
    buf.toString('latin1', 8, 12) !== 'WAVE'
  ) {
    throw new Error('Not a RIFF/WAVE file')
  }

  let format: number | undefined
  let channels = 0
  let sampleRate = 0
  let bitDepth = 0
  let data: Buffer | undefined

  let off = 12
  while (off + 8 <= buf.length) {
    const id = buf.toString('latin1', off, off + 4)
    const size = buf.readUInt32LE(off + 4)
    const body = off + 8
    const end = Math.min(body + size, buf.length)
    if (id === 'fmt ') {
      format = buf.readUInt16LE(body)
      channels = buf.readUInt16LE(body + 2)
      sampleRate = buf.readUInt32LE(body + 4)
      bitDepth = buf.readUInt16LE(body + 14)
      if (format === FORMAT_EXTENSIBLE) format = buf.readUInt16LE(body + 24)
    } else if (id === 'data') {
      data = buf.subarray(body, end)
    }
    off = body + size + (size % 2)
  }

  if (format === undefined || !data) throw new Error('WAV file has no fmt or data chunk')
  if (format !== FORMAT_PCM && format !== FORMAT_FLOAT) {
    throw new Error(`Unsupported WAV format code ${format}; only PCM and IEEE float are decoded`)
  }

  const read = sampleReader(format, bitDepth)
  const bytesPerSample = bitDepth / 8
  const frames = Math.floor(data.length / (bytesPerSample * channels))
  const samples = new Float32Array(frames)
  for (let i = 0; i < frames; i++) {
    let sum = 0
    for (let c = 0; c < channels; c++) {
      sum += read(data, (i * channels + c) * bytesPerSample)
    }
    samples[i] = sum / channels
  }
  return { sampleRate, channels, bitDepth, samples }
}

function sampleReader(format: number, bitDepth: number): (buf: Buffer, off: number) => number {
  if (format === FORMAT_FLOAT) {
    if (bitDepth === 32) return (b, o) => b.readFloatLE(o)
    if (bitDepth === 64) return (b, o) => b.readDoubleLE(o)
  } else {
    if (bitDepth === 8) return (b, o) => (b.readUInt8(o) - 128) / 128
    if (bitDepth === 16) return (b, o) => b.readInt16LE(o) / 32768
    if (bitDepth === 24) return (b, o) => b.readIntLE(o, 3) / 8388608
    if (bitDepth === 32) return (b, o) => b.readInt32LE(o) / 2147483648
  }
  throw new Error(`Unsupported WAV bit depth ${bitDepth} for format code ${format}`)
}
