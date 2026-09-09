import type { SpanInput } from 'shared'

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
