import { describe, expect, it } from 'vitest'
import { basename, MalformedTranscriptError, parseTranscriptJson } from './transcriptParser.ts'

describe('parseTranscriptJson', () => {
  it('accepts the production format and derives the filename from the path', () => {
    const { rows, rejected } = parseTranscriptJson(
      JSON.stringify([
        { path: 'audio/880_NTX.wav', label: 'Kontrollierte Rueckenlagerung' },
        { path: '881_TUR.wav', label: '' },
      ]),
    )
    expect(rejected).toEqual([])
    expect(rows).toEqual([
      {
        row: 1,
        path: 'audio/880_NTX.wav',
        filename: '880_NTX.wav',
        label: 'Kontrollierte Rueckenlagerung',
      },
      { row: 2, path: '881_TUR.wav', filename: '881_TUR.wav', label: '' },
    ])
  })

  it('throws on malformed JSON and on non-array roots', () => {
    expect(() => parseTranscriptJson('[{"path": "a.wav", "label": ')).toThrow(
      MalformedTranscriptError,
    )
    expect(() => parseTranscriptJson('{"path": "a.wav", "label": "x"}')).toThrow(/array/)
  })

  it('rejects rows with missing fields but keeps the good ones', () => {
    const { rows, rejected } = parseTranscriptJson(
      JSON.stringify([
        { path: 'a.wav', label: 'ok' },
        { label: 'no path' },
        { path: 'c.wav' },
        { path: '', label: 'empty path' },
        { path: 'dir/', label: 'no filename' },
        'not an object',
        { path: 'b.wav', label: 'ok too' },
      ]),
    )
    expect(rows.map((r) => r.path)).toEqual(['a.wav', 'b.wav'])
    expect(rejected).toEqual([
      { row: 2, path: null, reason: 'Missing "path"' },
      { row: 3, path: 'c.wav', reason: 'Missing "label"' },
      { row: 4, path: '', reason: 'Missing "path"' },
      { row: 5, path: 'dir/', reason: '"path" has no filename' },
      { row: 6, path: null, reason: 'Row is not an object' },
    ])
  })

  it('keeps the first of duplicate paths and reports the rest', () => {
    const { rows, rejected } = parseTranscriptJson(
      JSON.stringify([
        { path: 'a.wav', label: 'first' },
        { path: 'a.wav', label: 'second' },
        { path: 'a.wav', label: 'third' },
      ]),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].label).toBe('first')
    expect(rejected.map((r) => r.reason)).toEqual([
      'Duplicate path, first seen in row 1',
      'Duplicate path, first seen in row 1',
    ])
  })
})

describe('basename', () => {
  it('handles both separators', () => {
    expect(basename('audio/880_NTX.wav')).toBe('880_NTX.wav')
    expect(basename('C:\\dictation\\881.m4a')).toBe('881.m4a')
    expect(basename('plain.mp3')).toBe('plain.mp3')
  })
})
