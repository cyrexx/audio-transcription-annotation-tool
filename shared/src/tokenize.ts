/**
 * Whitespace tokenization shared by server and client. Spans, word clicks and the speech
 * rate all refer to these tokens, so both sides must split text identically.
 */
export interface Token {
  text: string
  /** Character offset of the first character in the source text. */
  start: number
  /** Character offset one past the last character. */
  end: number
}

const WORD = /\S+/g

export function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  for (const match of text.matchAll(WORD)) {
    tokens.push({ text: match[0], start: match.index, end: match.index + match[0].length })
  }
  return tokens
}

export function tokenCount(text: string): number {
  return tokenize(text).length
}
