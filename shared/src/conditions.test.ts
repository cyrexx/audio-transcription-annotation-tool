import { describe, expect, it } from 'vitest'
import { estimateDistance, speechRateWpm } from './conditions.ts'

describe('speechRateWpm', () => {
  it('converts tokens over seconds into words per minute', () => {
    expect(speechRateWpm(60, 30)).toBe(120)
    expect(speechRateWpm(47, 21.3)).toBe(132)
  })

  it('is null without a usable duration', () => {
    expect(speechRateWpm(10, 0)).toBeNull()
  })
})

describe('estimateDistance', () => {
  it('calls a hot, clean signal close', () => {
    expect(estimateDistance({ rmsDbfs: -18, peakDbfs: -3, noiseFloorDbfs: -60, snrDb: 42 })).toBe(
      'close',
    )
  })

  it('calls a weak or noisy signal far', () => {
    expect(estimateDistance({ rmsDbfs: -45, peakDbfs: -25, noiseFloorDbfs: -55, snrDb: 10 })).toBe(
      'far',
    )
    expect(estimateDistance({ rmsDbfs: -20, peakDbfs: -5, noiseFloorDbfs: -30, snrDb: 10 })).toBe(
      'far',
    )
  })

  it('calls everything in between medium', () => {
    expect(estimateDistance({ rmsDbfs: -30, peakDbfs: -10, noiseFloorDbfs: -52, snrDb: 22 })).toBe(
      'medium',
    )
  })
})
