import { sameTypeAndRange, type SpanInput } from 'shared'

/** A span while it is being edited: the input shape plus a client-side id. */
export type EditorSpan = SpanInput & { id: string }

/** Spans covering a token, innermost first; the tightest one decides colour and click-to-open. */
export function coveringSpans<S extends { start: number; end: number }>(
  spans: readonly S[],
  index: number,
): S[] {
  return spans
    .filter((s) => s.start <= index && index < s.end)
    .sort((a, b) => a.end - a.start - (b.end - b.start))
}

export const innermostSpanAt = <S extends { start: number; end: number }>(
  spans: readonly S[],
  index: number,
): S | undefined => coveringSpans(spans, index)[0]

/**
 * Drops all but the first of any same-type spans on the same words. A text edit that joins two
 * annotated words pushes both spans onto the joined word; one span per type per range is the
 * rule, so the later one goes, as an emptied span would.
 */
export function withoutTwins<S extends { type: SpanInput['type']; start: number; end: number }>(
  spans: readonly S[],
): S[] {
  return spans.filter(
    (span, i) => !spans.some((other, j) => j < i && sameTypeAndRange(span, other)),
  )
}
