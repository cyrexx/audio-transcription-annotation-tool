import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../src/db.ts'
import { api, createPairedItem, resetDb, uploadWav } from './helpers/api.ts'

beforeEach(resetDb)

const TEXT =
  'Single-Shot-Antibiose mit Cefuroxim eintausendfuenfhundert Milligramm neue Zeile Prolene sechs null fortlaufend'

/** The worked example from the brief, over the 11 tokens of TEXT. */
const SPANS = [
  { type: 'MEDICAL_TERM', start: 2, end: 3, attributes: { category: 'drug', note: '' } },
  { type: 'MEASUREMENT', start: 3, end: 5, attributes: { value: 1500, unit: 'mg' } },
  { type: 'NUMBER', start: 3, end: 4, attributes: { rendering: 'words', value: '1500' } },
  {
    type: 'FORMATTING_COMMAND',
    start: 5,
    end: 7,
    attributes: { command: 'newline', interpretation: 'command' },
  },
  { type: 'MEDICAL_TERM', start: 7, end: 8, attributes: { category: 'device', note: 'suture' } },
  { type: 'NUMBER', start: 8, end: 10, attributes: { rendering: 'words', value: '6/0' } },
]

const baseUpdate = {
  correctedText: TEXT,
  spans: SPANS,
  speechRateWpmOverride: null,
  distanceOverride: null,
  annotator: 'Joe',
}

describe('PUT /api/items/:id/annotation', () => {
  it('persists spans of every type and returns them sorted, with derived attributes', async () => {
    const id = await createPairedItem('example.wav', TEXT)
    const { body } = await api().put(`/api/items/${id}/annotation`).send(baseUpdate).expect(200)

    expect(body.status).toBe('IN_PROGRESS')
    expect(body.annotator).toBe('Joe')
    expect(body.spans).toHaveLength(6)
    expect(body.spans.map((s: { start: number }) => s.start)).toEqual([2, 3, 3, 5, 7, 8])
    const measurement = body.spans.find((s: { type: string }) => s.type === 'MEASUREMENT')
    expect(measurement.attributes).toEqual({
      value: 1500,
      unit: 'mg',
      normalizedValue: 1.5,
      normalizedUnit: 'g',
    })

    const reloaded = await api().get(`/api/items/${id}`).expect(200)
    expect(reloaded.body.spans).toEqual(body.spans)
    expect(reloaded.body.originalText).toBe(TEXT)
  })

  it('replaces the previous spans instead of accumulating them', async () => {
    const id = await createPairedItem('replace.wav', TEXT)
    await api().put(`/api/items/${id}/annotation`).send(baseUpdate).expect(200)
    const { body } = await api()
      .put(`/api/items/${id}/annotation`)
      .send({ ...baseUpdate, spans: SPANS.slice(0, 1) })
      .expect(200)
    expect(body.spans).toHaveLength(1)
    expect(await prisma.span.count()).toBe(1)
  })

  it('keeps the corrected text separate from the immutable original', async () => {
    const id = await createPairedItem('immutable.wav', 'Cefuroxin eintausend')
    const { body } = await api()
      .put(`/api/items/${id}/annotation`)
      .send({ ...baseUpdate, correctedText: 'Cefuroxim eintausend', spans: [] })
      .expect(200)
    expect(body.originalText).toBe('Cefuroxin eintausend')
    expect(body.correctedText).toBe('Cefuroxim eintausend')
    expect(body.recording.speechRateWpm).toBe(6) // 2 tokens over 20 s
  })

  it('rejects a span that runs past the end of the text, and changes nothing', async () => {
    const id = await createPairedItem('range.wav', TEXT)
    await api().put(`/api/items/${id}/annotation`).send(baseUpdate).expect(200)
    const bad = { type: 'NAMED_ENTITY', start: 10, end: 13, attributes: { kind: 'person' } }
    const res = await api()
      .put(`/api/items/${id}/annotation`)
      .send({ ...baseUpdate, spans: [bad] })
      .expect(400)
    expect(res.body.error).toMatch(/ends at token 13 but the text has 11 tokens/)
    expect(await prisma.span.count()).toBe(6)
  })

  it('rejects a second span of the same type on the same words, whatever its attributes', async () => {
    const id = await createPairedItem('twins.wav', TEXT)
    const twins = [
      { type: 'MEDICAL_TERM', start: 2, end: 3, attributes: { category: 'drug', note: '' } },
      {
        type: 'MEDICAL_TERM',
        start: 2,
        end: 3,
        attributes: { category: 'drug', note: 'other note' },
      },
    ]
    const res = await api()
      .put(`/api/items/${id}/annotation`)
      .send({ ...baseUpdate, spans: twins })
      .expect(400)
    expect(res.body.error).toMatch(/spans\.1: same type on the same words as spans\.0/)
    expect(await prisma.span.count()).toBe(0)

    // A different type on the same words is an overlap, which is allowed.
    const overlap = [
      twins[0],
      { type: 'SPELLED_OUT', start: 2, end: 3, attributes: { resolved: 'Cefuroxim' } },
    ]
    await api()
      .put(`/api/items/${id}/annotation`)
      .send({ ...baseUpdate, spans: overlap })
      .expect(200)
  })

  it('rejects attributes that do not match the span type', async () => {
    const id = await createPairedItem('attrs.wav', TEXT)
    const bad = {
      type: 'MEASUREMENT',
      start: 3,
      end: 5,
      attributes: { value: 1500, unit: 'stone' },
    }
    const res = await api()
      .put(`/api/items/${id}/annotation`)
      .send({ ...baseUpdate, spans: [bad] })
      .expect(400)
    expect(res.body.error).toMatch(/spans\.0\.attributes\.unit/)
  })

  it('stores overrides and marks items done or reopened', async () => {
    const id = await createPairedItem('done.wav', TEXT)
    const { body: done } = await api()
      .put(`/api/items/${id}/annotation`)
      .send({ ...baseUpdate, speechRateWpmOverride: 140, distanceOverride: 'far', status: 'DONE' })
      .expect(200)
    expect(done).toMatchObject({
      status: 'DONE',
      speechRateWpmOverride: 140,
      distanceOverride: 'far',
    })

    const { body: reopened } = await api()
      .put(`/api/items/${id}/annotation`)
      .send({ ...baseUpdate, status: 'IN_PROGRESS' })
      .expect(200)
    expect(reopened.status).toBe('IN_PROGRESS')
  })

  it('answers 404 for an unknown item', async () => {
    await api().put('/api/items/does-not-exist/annotation').send(baseUpdate).expect(404)
    await api().get('/api/items/does-not-exist').expect(404)
  })

  it('refuses to annotate auto-rejected items and items without a transcript', async () => {
    const { body: short } = await uploadWav('short.wav', { seconds: 5 })
    const rejected = await api()
      .put(`/api/items/${short.itemId}/annotation`)
      .send(baseUpdate)
      .expect(409)
    expect(rejected.body.error).toMatch(/Auto-rejected/)

    const { body: bare } = await uploadWav('bare.wav', { seconds: 20 })
    const noText = await api()
      .put(`/api/items/${bare.itemId}/annotation`)
      .send(baseUpdate)
      .expect(409)
    expect(noText.body.error).toMatch(/no transcript/)
  })
})
