import { describe, expect, it } from 'vitest'
import { MEASUREMENT_UNITS, normalizeMeasurement } from './units.ts'

describe('normalizeMeasurement', () => {
  it('normalizes the example from the brief: 1500 mg is 1.5 g', () => {
    expect(normalizeMeasurement(1500, 'mg')).toEqual({ normalizedValue: 1.5, normalizedUnit: 'g' })
  })

  it.each([
    [250, 'ug', 0.00025, 'g'],
    [2, 'kg', 2000, 'g'],
    [50, 'ml', 0.05, 'l'],
    [2, 'l', 2, 'l'],
    [15, 'mm', 0.015, 'm'],
    [3.5, 'cm', 0.035, 'm'],
    [120, 'mmHg', 120, 'mmHg'],
    [5000, 'IE', 5000, 'IE'],
    [20, 'Ch', 20, 'Ch'],
  ] as const)('%s %s -> %s %s', (value, unit, normalizedValue, normalizedUnit) => {
    expect(normalizeMeasurement(value, unit)).toEqual({ normalizedValue, normalizedUnit })
  })

  it('does not leak floating point noise', () => {
    expect(normalizeMeasurement(0.1, 'mg').normalizedValue).toBe(0.0001)
    expect(normalizeMeasurement(0.3, 'cm').normalizedValue).toBe(0.003)
  })

  it('covers every unit the brief lists', () => {
    for (const unit of MEASUREMENT_UNITS) {
      expect(Number.isFinite(normalizeMeasurement(1, unit).normalizedValue)).toBe(true)
    }
  })
})
