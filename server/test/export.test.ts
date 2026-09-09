import { beforeEach, describe, expect, it } from 'vitest'
import { api, createPairedItem, resetDb } from './helpers/api.ts'

beforeEach(resetDb)

const update = {
  correctedText: 'Cefuroxim eintausendfuenfhundert Milligramm',
  spans: [{ type: 'MEASUREMENT', start: 1, end: 3, attributes: { value: 1500, unit: 'mg' } }],
  speechRateWpmOverride: null,
  distanceOverride: null,
  annotator: 'Joe',
}

/** superagent does not buffer unknown content types, so read the NDJSON body by hand. */
async function exportLines(query = '') {
  const res = await api()
    .get(`/api/export${query}`)
    .buffer(true)
    .parse((response, cb) => {
      let text = ''
      response.setEncoding('utf8')
      response.on('data', (chunk: string) => (text += chunk))
      response.on('end', () => cb(null, text))
    })
    .expect(200)
  return {
    res,
    records: (res.body as string)
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l)),
  }
}

describe('GET /api/export', () => {
  it('exports finished items as JSONL with text, spans and recording conditions', async () => {
    const id = await createPairedItem('done.wav', 'Cefuroxin eintausendfuenfhundert Milligramm')
    await api()
      .put(`/api/items/${id}/annotation`)
      .send({ ...update, status: 'DONE' })
      .expect(200)

    const { res, records } = await exportLines()
    expect(res.headers['content-type']).toMatch(/x-ndjson/)
    expect(res.headers['content-disposition']).toMatch(/gold-standard\.jsonl/)

    const [record] = records
    expect(record).toMatchObject({
      itemId: id,
      audio: { filename: 'done.wav', sourcePath: 'audio/done.wav', mimeType: 'audio/wav' },
      status: 'DONE',
      annotator: 'Joe',
      originalTranscript: 'Cefuroxin eintausendfuenfhundert Milligramm',
      correctedTranscript: 'Cefuroxim eintausendfuenfhundert Milligramm',
      recordingConditions: {
        durationSec: 20,
        sampleRate: 16000,
        channels: 1,
        bitDepth: 16,
        speechRateWpm: 9,
        speechRateSource: 'derived',
        distance: 'far',
        distanceSource: 'derived',
      },
    })
    expect(record.audio.storagePath).toMatch(/\.wav$/)
    expect(record.spans[0]).not.toHaveProperty('id')
    expect(record.spans).toEqual([
      expect.objectContaining({
        type: 'MEASUREMENT',
        start: 1,
        end: 3,
        charStart: 10,
        charEnd: 43,
        text: 'eintausendfuenfhundert Milligramm',
        attributes: { value: 1500, unit: 'mg', normalizedValue: 1.5, normalizedUnit: 'g' },
      }),
    ])
  })

  it('exports the annotator override instead of the derived value', async () => {
    const id = await createPairedItem('override.wav', 'x')
    await api()
      .put(`/api/items/${id}/annotation`)
      .send({ ...update, speechRateWpmOverride: 150, distanceOverride: 'close', status: 'DONE' })
      .expect(200)
    const [record] = (await exportLines()).records
    expect(record.recordingConditions).toMatchObject({
      speechRateWpm: 150,
      speechRateSource: 'annotator',
      distance: 'close',
      distanceSource: 'annotator',
    })
  })

  it('leaves unfinished items out unless asked for', async () => {
    const id = await createPairedItem('wip.wav', 'x')
    await api().put(`/api/items/${id}/annotation`).send(update).expect(200)
    expect((await exportLines()).records).toEqual([])
    const { records } = await exportLines('?includeUnfinished=true')
    expect(records.map((r) => r.status)).toEqual(['IN_PROGRESS'])
  })
})
