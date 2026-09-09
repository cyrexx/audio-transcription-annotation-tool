import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { sine, synthWav } from '../../test/helpers/synthWav.ts'
import { analyzeAudio, UnsupportedAudioError } from './analyze.ts'

async function tempFile(name: string, content: Buffer): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'analyze-'))
  const file = path.join(dir, name)
  await writeFile(file, content)
  return file
}

describe('analyzeAudio', () => {
  it('reads duration, format facts and levels from a WAV header', async () => {
    const file = await tempFile(
      'a.wav',
      synthWav({
        seconds: 2.5,
        sampleRate: 22050,
        channels: 2,
        bitDepth: 24,
        signal: sine(440, 0.5),
      }),
    )
    const facts = await analyzeAudio(file)
    expect(facts).toMatchObject({
      kind: 'wav',
      sampleRate: 22050,
      channels: 2,
      bitDepth: 24,
      container: 'WAVE',
      levelsError: null,
    })
    expect(facts.durationSec).toBeCloseTo(2.5, 3)
    expect(facts.levels?.peakDbfs).toBeCloseTo(-6, 0)
  })

  it('exposes bext and LIST INFO metadata written by the recorder', async () => {
    const file = await tempFile(
      'b.wav',
      synthWav({
        seconds: 0.1,
        bext: {
          description: 'OP 3, Saal 2',
          originator: 'Recorder X',
          originationDate: '2026-09-07',
        },
        info: { IART: 'Dr. Müller', ISFT: 'Olympus DS-9500' },
      }),
    )
    const { metadata } = await analyzeAudio(file)
    expect(metadata).toMatchObject({
      'bext.description': 'OP 3, Saal 2',
      'bext.originator': 'Recorder X',
      'bext.originationDate': '2026-09-07',
      IART: 'Dr. Müller',
      ISFT: 'Olympus DS-9500',
    })
  })

  it('has empty metadata when the recorder wrote none', async () => {
    const file = await tempFile('c.wav', synthWav({ seconds: 0.1 }))
    expect((await analyzeAudio(file)).metadata).toEqual({})
  })

  it('rejects files that are not audio', async () => {
    const file = await tempFile('d.wav', Buffer.from('{"not": "audio"}'))
    await expect(analyzeAudio(file)).rejects.toBeInstanceOf(UnsupportedAudioError)
  })
})

describe('analyzeAudio against crafted headers', () => {
  it('rejects a header that yields an infinite duration', async () => {
    const wav = synthWav({ seconds: 0.1 })
    wav.writeUInt16LE(0, 32) // fmt.blockAlign = 0 makes duration = data / 0
    const file = await tempFile('inf.wav', wav)
    await expect(analyzeAudio(file)).rejects.toThrow(/duration/)
  })

  it('rejects absurd sample rates instead of grinding through them', async () => {
    const file = await tempFile('sr1.wav', synthWav({ seconds: 1, sampleRate: 1 }))
    await expect(analyzeAudio(file)).rejects.toThrow(/sample rate/)
  })

  it('skips the level analysis, with a reason, beyond the duration cap', async () => {
    const file = await tempFile(
      'long.wav',
      synthWav({ seconds: 3601, sampleRate: 1000, bitDepth: 8 }),
    )
    const facts = await analyzeAudio(file)
    expect(facts.durationSec).toBeCloseTo(3601, 0)
    expect(facts.levels).toBeNull()
    expect(facts.levelsError).toMatch(/60 minutes/)
  })

  it('truncates oversized recorder metadata', async () => {
    const file = await tempFile(
      'meta.wav',
      synthWav({ seconds: 0.1, info: { ICMT: 'x'.repeat(5000) } }),
    )
    const { metadata } = await analyzeAudio(file)
    expect(metadata.ICMT).toHaveLength(1001)
    expect(metadata.ICMT.endsWith('…')).toBe(true)
  })
})
