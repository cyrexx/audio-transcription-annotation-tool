/**
 * Keeps token-based spans attached to the right words while the annotator edits the text.
 *
 * A textarea edit is one contiguous change, so the old and new token lists share a common
 * prefix and suffix. Spans before the change stay put, spans after it shift by the token
 * delta, and spans overlapping it stretch to cover the edited region. A span that would
 * become empty is dropped.
 */
export function shiftSpans<S extends { start: number; end: number }>(
  oldTokens: readonly string[],
  newTokens: readonly string[],
  spans: readonly S[],
): S[] {
  const shortest = Math.min(oldTokens.length, newTokens.length)
  let prefix = 0
  while (prefix < shortest && oldTokens[prefix] === newTokens[prefix]) prefix++
  let suffix = 0
  while (
    suffix < shortest - prefix &&
    oldTokens[oldTokens.length - 1 - suffix] === newTokens[newTokens.length - 1 - suffix]
  ) {
    suffix++
  }

  const oldEnd = oldTokens.length - suffix
  const newEnd = newTokens.length - suffix
  const delta = newEnd - oldEnd
  if (oldEnd === prefix && delta === 0) return [...spans]

  return spans.flatMap((span) => {
    if (span.end <= prefix) return [span]
    if (span.start >= oldEnd) return [{ ...span, start: span.start + delta, end: span.end + delta }]
    const start = Math.min(span.start, prefix)
    const end = Math.max(span.end + delta, newEnd)
    return end > start ? [{ ...span, start, end }] : []
  })
}
