/**
 * Keeps token-based spans attached to the right words while the annotator edits the text.
 *
 * The old and new token lists are diffed into hunks (contiguous replaced regions). Span
 * boundaries before a hunk stay, boundaries after it shift by the hunk's token delta, and a
 * boundary inside a hunk snaps to the hunk's edge so the span stretches over the edited words.
 * A span that would become empty is dropped. A keystroke produces one tiny hunk; pasting a
 * corrected paragraph produces one hunk per changed place, so unrelated spans stay untouched.
 */
export function shiftSpans<S extends { start: number; end: number }>(
  oldTokens: readonly string[],
  newTokens: readonly string[],
  spans: readonly S[],
): S[] {
  const hunks = diffHunks(oldTokens, newTokens)
  if (hunks.length === 0) return [...spans]
  return spans.flatMap((span) => {
    const start = mapBoundary(span.start, hunks, true)
    const end = mapBoundary(span.end, hunks, false)
    return end > start ? [{ ...span, start, end }] : []
  })
}

/** 16 million cells is a 64 MB table and well past any dictation; 20k x 20k would be 1.6 GB. */
const MAX_TABLE_CELLS = 16_000_000

interface Hunk {
  oldStart: number
  oldEnd: number
  newStart: number
  newEnd: number
}

/**
 * Maps a token boundary from the old text to the new one. A start boundary sitting exactly
 * on an insertion moves after it, an end boundary stays before it, so inserted words never
 * silently join a neighbouring span.
 */
function mapBoundary(position: number, hunks: Hunk[], isStart: boolean): number {
  let delta = 0
  for (const h of hunks) {
    const before = isStart ? position < h.oldStart : position <= h.oldStart
    if (before) break
    const after = isStart ? position >= h.oldEnd : position > h.oldEnd
    if (after) {
      delta += h.newEnd - h.newStart - (h.oldEnd - h.oldStart)
      continue
    }
    return isStart ? h.newStart : h.newEnd
  }
  return position + delta
}

/** Replaced regions between two token lists, in order, from a longest-common-subsequence alignment. */
function diffHunks(oldTokens: readonly string[], newTokens: readonly string[]): Hunk[] {
  // Trim the common prefix and suffix first: a keystroke then leaves a one-token problem.
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
  const a = oldTokens.slice(prefix, oldTokens.length - suffix)
  const b = newTokens.slice(prefix, newTokens.length - suffix)
  if (a.length === 0 && b.length === 0) return []
  // A pasted rewrite of a very long text would need a table of a.length * b.length cells; past
  // this size the whole changed region counts as one replacement instead.
  if (a.length * b.length > MAX_TABLE_CELLS) {
    return [
      { oldStart: prefix, oldEnd: prefix + a.length, newStart: prefix, newEnd: prefix + b.length },
    ]
  }

  // LCS table over the middle part only.
  const width = b.length + 1
  const lcs = new Uint32Array((a.length + 1) * width)
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i * width + j] =
        a[i] === b[j]
          ? lcs[(i + 1) * width + j + 1] + 1
          : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1])
    }
  }

  // Walk the alignment; every maximal run of unmatched tokens on either side is one hunk.
  const hunks: Hunk[] = []
  let i = 0
  let j = 0
  let open: Hunk | null = null
  const close = () => {
    if (open) hunks.push(open)
    open = null
  }
  while (i < a.length || j < b.length) {
    const matched = i < a.length && j < b.length && a[i] === b[j]
    if (matched) {
      close()
      i++
      j++
      continue
    }
    open ??= { oldStart: prefix + i, oldEnd: prefix + i, newStart: prefix + j, newEnd: prefix + j }
    const takeOld =
      j >= b.length || (i < a.length && lcs[(i + 1) * width + j] >= lcs[i * width + j + 1])
    if (takeOld) {
      i++
      open.oldEnd++
    } else {
      j++
      open.newEnd++
    }
  }
  close()
  return hunks
}
