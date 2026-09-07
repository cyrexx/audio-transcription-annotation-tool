import { beforeEach, describe, expect, it } from 'vitest'
import { api, importTranscripts, resetDb, uploadWav } from './helpers/api.ts'

beforeEach(resetDb)

describe('pairing', () => {
  it('pairs a transcript that arrives after the audio', async () => {
    const { body: upload } = await uploadWav('880_NTX.wav', { seconds: 16 }).expect(201)
    expect(upload.pairedTranscriptId).toBeNull()

    const { body: report } = await importTranscripts([
      { path: 'audio/880_NTX.wav', label: 'Lagerung' },
    ]).expect(200)
    expect(report.accepted).toEqual([
      expect.objectContaining({ path: 'audio/880_NTX.wav', pairedItemId: upload.itemId }),
    ])

    const { body: item } = await api().get(`/api/items/${upload.itemId}`).expect(200)
    expect(item.originalText).toBe('Lagerung')
    expect(item.correctedText).toBe('Lagerung')
    expect(item.transcript.source).toBe('FILE')
  })

  it('pairs audio that arrives after the transcript', async () => {
    const { body: report } = await importTranscripts([
      { path: '881_TUR.wav', label: 'Abwaschen' },
    ]).expect(200)
    expect(report.accepted[0].pairedItemId).toBeNull()

    const { body: upload } = await uploadWav('881_TUR.wav', { seconds: 16 }).expect(201)
    expect(upload.pairedTranscriptId).toBe(report.accepted[0].transcriptId)
  })

  it('reports every bad row and keeps the good ones', async () => {
    await importTranscripts([{ path: 'old.wav', label: 'already there' }]).expect(200)
    const { body } = await importTranscripts([
      { path: 'good.wav', label: 'fine' },
      { path: 'missing-label.wav' },
      { path: 'good.wav', label: 'duplicate in file' },
      { path: 'old.wav', label: 'duplicate of an earlier import' },
    ]).expect(200)
    expect(body.accepted.map((a: { path: string }) => a.path)).toEqual(['good.wav'])
    expect(body.rejected).toEqual([
      { index: 1, path: 'missing-label.wav', reason: 'Missing "label"' },
      { index: 2, path: 'good.wav', reason: 'Duplicate path, first seen in row 0' },
      { index: 3, path: 'old.wav', reason: 'Duplicate path, already imported earlier' },
    ])
  })

  it('rejects malformed JSON as a whole', async () => {
    const res = await importTranscripts('[{"path": "x.wav", "label": ').expect(400)
    expect(res.body.error).toMatch(/Malformed JSON/)
  })

  it('shows unmatched audio and unmatched transcripts on both sides', async () => {
    await uploadWav('lonely-audio.wav', { seconds: 16 })
    await importTranscripts([{ path: 'lonely-transcript.wav', label: 'Nobody uploaded me' }])
    const { body } = await api().get('/api/pairing').expect(200)
    expect(body.items).toEqual([expect.objectContaining({ filename: 'lonely-audio.wav' })])
    expect(body.transcripts).toEqual([
      expect.objectContaining({ filename: 'lonely-transcript.wav', preview: 'Nobody uploaded me' }),
    ])
  })

  it('lets the user pair and unpair manually', async () => {
    const { body: upload } = await uploadWav('renamed.wav', { seconds: 16 })
    const { body: report } = await importTranscripts([{ path: 'original-name.wav', label: 'Text' }])
    const transcriptId = report.accepted[0].transcriptId

    await api().post(`/api/items/${upload.itemId}/pair`).send({ transcriptId }).expect(204)
    let { body: item } = await api().get(`/api/items/${upload.itemId}`)
    expect(item.correctedText).toBe('Text')
    expect((await api().get('/api/pairing')).body).toEqual({ items: [], transcripts: [] })

    await api().post(`/api/items/${upload.itemId}/pair`).send({ transcriptId }).expect(409)

    await api().post(`/api/items/${upload.itemId}/unpair`).expect(204)
    ;({ body: item } = await api().get(`/api/items/${upload.itemId}`))
    expect(item.transcript).toBeNull()
    expect(item.correctedText).toBeNull()
    expect((await api().get('/api/pairing')).body.transcripts).toHaveLength(1)
  })

  it('accepts a transcript pasted for one item', async () => {
    const { body: upload } = await uploadWav('pasted.wav', { seconds: 16 })
    const { body: item } = await api()
      .post(`/api/items/${upload.itemId}/transcript`)
      .send({ label: 'Getippter Text' })
      .expect(200)
    expect(item.transcript.source).toBe('PASTE')
    expect(item.originalText).toBe('Getippter Text')
    await api().post(`/api/items/${upload.itemId}/transcript`).send({ label: 'again' }).expect(409)
  })
})
