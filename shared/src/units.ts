export const MEASUREMENT_UNITS = [
  'g',
  'mg',
  'ug',
  'kg',
  'ml',
  'l',
  'mmHg',
  'IE',
  'mm',
  'cm',
  'Ch',
] as const
export type MeasurementUnit = (typeof MEASUREMENT_UNITS)[number]

/**
 * Base unit per quantity and the factor from each unit into it. "Base" means the unprefixed
 * unit, following the brief's example of 1500 mg becoming 1.5 g. Units without an SI prefix
 * (mmHg, IE, Ch) normalize to themselves.
 */
const NORMALIZATION: Record<MeasurementUnit, { base: string; factor: number }> = {
  g: { base: 'g', factor: 1 },
  mg: { base: 'g', factor: 1e-3 },
  ug: { base: 'g', factor: 1e-6 },
  kg: { base: 'g', factor: 1e3 },
  ml: { base: 'l', factor: 1e-3 },
  l: { base: 'l', factor: 1 },
  mm: { base: 'm', factor: 1e-3 },
  cm: { base: 'm', factor: 1e-2 },
  mmHg: { base: 'mmHg', factor: 1 },
  IE: { base: 'IE', factor: 1 },
  Ch: { base: 'Ch', factor: 1 },
}

export interface NormalizedMeasurement {
  normalizedValue: number
  normalizedUnit: string
}

export function normalizeMeasurement(value: number, unit: MeasurementUnit): NormalizedMeasurement {
  const { base, factor } = NORMALIZATION[unit]
  // toPrecision trims binary floating point noise such as 0.1 * 1e-3 = 0.00010000000000000002
  return { normalizedValue: Number((value * factor).toPrecision(12)), normalizedUnit: base }
}
