import { describe, expect, it } from 'vitest'
import { routeByDuration } from './routing.ts'

describe('routeByDuration', () => {
  it('auto-rejects recordings of 15 seconds and under', () => {
    expect(routeByDuration(0)).toBe('AUTO_REJECTED')
    expect(routeByDuration(3.2)).toBe('AUTO_REJECTED')
    expect(routeByDuration(14.999)).toBe('AUTO_REJECTED')
    expect(routeByDuration(15)).toBe('AUTO_REJECTED')
  })

  it('routes anything longer than 15 seconds to a human', () => {
    expect(routeByDuration(15.001)).toBe('PENDING')
    expect(routeByDuration(60)).toBe('PENDING')
  })
})
