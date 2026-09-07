import { describe, expect, it } from 'vitest'
import { sine, synthWav } from '../../test/helpers/synthWav.ts'
import { decodeWav } from './wav.ts'

describe('decodeWav', () => {
  it.each([
    [8, false],
    [16, false],
    [24, false],
    [32, false],
    [32, true],
  ])('decodes %s-bit (float: %s) PCM back to the generated signal', (bitDepth, float) => {
    const wav = synthWav({
      seconds: 0.01,
      sampleRate: 8000,
      bitDepth,
      float,
      signal: sine(100, 0.5),
    })
    const pcm = decodeWav(wav)
    expect(pcm).toMatchObject({ sampleRate: 8000, channels: 1, bitDepth })
    expect(pcm.samples).toHaveLength(80)
    const tolerance = bitDepth === 8 ? 0.01 : 0.001
    for (let i = 0; i < 80; i++) {
      const expected = 0.5 * Math.sin((2 * Math.PI * 100 * i) / 8000)
      expect(Math.abs(pcm.samples[i] - expected)).toBeLessThan(tolerance)
    }
  })

  it('mixes stereo down to mono', () => {
    const wav = synthWav({
      seconds: 0.001,
      sampleRate: 4000,
      channels: 2,
      signal: (_t, channel) => (channel === 0 ? 0.8 : 0.2),
    })
    const pcm = decodeWav(wav)
    expect(pcm.channels).toBe(2)
    expect(pcm.samples[0]).toBeCloseTo(0.5, 3)
  })

  it('skips unrelated chunks such as bext and LIST INFO', () => {
    const wav = synthWav({
      seconds: 0.001,
      sampleRate: 4000,
      bext: { description: 'x' },
      info: { IART: 'y' },
    })
    expect(decodeWav(wav).samples).toHaveLength(4)
  })

  it('rejects non-WAV data and compressed WAV', () => {
    expect(() => decodeWav(Buffer.from('ID3 not a wav file at all'))).toThrow(/RIFF/)
    const wav = synthWav({ seconds: 0.001, sampleRate: 4000 })
    wav.writeUInt16LE(0x55, 20) // MPEG Layer 3 inside WAV
    expect(() => decodeWav(wav)).toThrow(/format code 85/)
  })
})
