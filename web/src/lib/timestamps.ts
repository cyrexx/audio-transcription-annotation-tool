/**
 * The transcript carries no word timings, so a word's time is interpolated from its
 * character position. Good enough to land the playhead near the word.
 */
export function estimateTokenTime(
  charStart: number,
  textLength: number,
  durationSec: number,
): number {
  if (textLength === 0) return 0
  return (charStart / textLength) * durationSec
}
