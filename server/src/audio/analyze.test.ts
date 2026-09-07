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
