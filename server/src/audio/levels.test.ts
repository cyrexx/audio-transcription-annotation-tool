import { describe, expect, it } from 'vitest'
import { analyzeLevels } from './levels.ts'

const RATE = 8000
const fill = (seconds: number, fn: (t: number) => number) =>
  Float32Array.from({ length: seconds * RATE }, (_, i) => fn(i / RATE))

describe('analyzeLevels', () => {
  it('reports the floor value for digital silence', () => {
    expect(
      analyzeLevels(
        fill(1, () => 0),
        RATE,
      ),
    ).toEqual({
      rmsDbfs: -120,
      peakDbfs: -120,
      noiseFloorDbfs: -120,
      snrDb: 0,
    })
  })

  it('measures a full-scale sine at 0 dBFS peak and -3 dBFS RMS', () => {
    const levels = analyzeLevels(
      fill(1, (t) => Math.sin(2 * Math.PI * 440 * t)),
      RATE,
    )
    expect(levels.peakDbfs).toBeCloseTo(0, 0)
    expect(levels.rmsDbfs).toBeCloseTo(-3, 0)
    expect(levels.snrDb).toBeCloseTo(0, 0)
  })

  it('separates speech level from the pauses between phrases', () => {
    // Half a second of loud tone (speech) followed by faint noise (room tone).
    const tone = (t: number) => 0.5 * Math.sin(2 * Math.PI * 300 * t)
    // Deterministic pseudo-random noise, so the expected floor is the same on every run.
    let seed = 12345
    const noise = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return (seed / 2147483648 - 0.5) * 0.002
    }
    const signal = fill(1, (t) => (t < 0.5 ? tone(t) : noise()))
    const levels = analyzeLevels(signal, RATE)
    // Tone RMS is 0.5 / sqrt(2) = -9 dBFS; uniform noise RMS is 0.001 / sqrt(3) = -64.8 dBFS.
    expect(levels.noiseFloorDbfs).toBeCloseTo(-64.8, 0)
    expect(levels.snrDb).toBeCloseTo(55.8, 0)
    expect(levels.peakDbfs).toBeCloseTo(-6, 0)
  })

  it('does not crash on a signal shorter than one window', () => {
    expect(analyzeLevels(Float32Array.from([0.5, -0.5]), RATE).peakDbfs).toBeCloseTo(-6, 0)
    expect(analyzeLevels(new Float32Array(0), RATE).rmsDbfs).toBe(-120)
  })
})
