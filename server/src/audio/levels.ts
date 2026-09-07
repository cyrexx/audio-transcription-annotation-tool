import type { LevelAnalysis } from 'shared'

/** Value reported for digital silence instead of -Infinity. */
const SILENCE_DB = -120
const WINDOW_SEC = 0.05

const toDb = (linear: number) => (linear > 0 ? 20 * Math.log10(linear) : SILENCE_DB)
const round = (db: number) => Math.round(db * 10) / 10

/**
 * Level statistics over a mono signal in the range -1..1.
 *
 * The noise floor is the 10th percentile of RMS over 50 ms windows, which in dictation
 * lands in the pauses between phrases. The speech level is the 90th percentile, and the
 * difference between the two is the level-to-noise-floor ratio used as a distance proxy.
 */
export function analyzeLevels(samples: Float32Array, sampleRate: number): LevelAnalysis {
  let peak = 0
  let sumSquares = 0
  for (const x of samples) {
    const a = Math.abs(x)
    if (a > peak) peak = a
    sumSquares += x * x
  }
  const rms = samples.length ? Math.sqrt(sumSquares / samples.length) : 0

  const windowSize = Math.max(1, Math.round(sampleRate * WINDOW_SEC))
  const windowDb: number[] = []
  for (let start = 0; start + windowSize <= samples.length; start += windowSize) {
    let sq = 0
    for (let i = start; i < start + windowSize; i++) sq += samples[i] * samples[i]
    windowDb.push(toDb(Math.sqrt(sq / windowSize)))
  }
  if (windowDb.length === 0) windowDb.push(toDb(rms))
  windowDb.sort((a, b) => a - b)

  const noiseFloorDbfs = percentile(windowDb, 0.1)
  const speechDbfs = percentile(windowDb, 0.9)
  return {
    rmsDbfs: round(toDb(rms)),
    peakDbfs: round(toDb(peak)),
    noiseFloorDbfs: round(noiseFloorDbfs),
    snrDb: round(speechDbfs - noiseFloorDbfs),
  }
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
}
