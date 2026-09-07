export const DISTANCE_ESTIMATES = ['close', 'medium', 'far'] as const
export type DistanceEstimate = (typeof DISTANCE_ESTIMATES)[number]

/** Signal statistics of the whole recording, all in decibels. */
export interface LevelAnalysis {
  /** Overall RMS level relative to full scale. */
  rmsDbfs: number
  /** Loudest sample relative to full scale. */
  peakDbfs: number
  /** 10th percentile of short-window RMS: the quiet parts between words. */
  noiseFloorDbfs: number
  /** Speech level (90th percentile of window RMS) minus the noise floor. */
  snrDb: number
}

/** Words per minute over the whole recording, or null when it cannot be derived. */
export function speechRateWpm(tokens: number, durationSec: number): number | null {
  if (durationSec <= 0) return null
  return Math.round((tokens / durationSec) * 60)
}

/**
 * Heuristic microphone-distance proxy. A speaker close to the microphone produces a hot
 * signal well above the room's noise floor; a distant one produces a weak signal with a
 * small level-to-noise ratio. This is an estimate for the annotator to confirm or override.
 * It is fooled by gain normalization and by automatic gain control.
 */
export function estimateDistance(levels: LevelAnalysis): DistanceEstimate {
  if (levels.snrDb >= 30 && levels.rmsDbfs >= -25) return 'close'
  if (levels.snrDb < 15 || levels.rmsDbfs < -40) return 'far'
  return 'medium'
}
