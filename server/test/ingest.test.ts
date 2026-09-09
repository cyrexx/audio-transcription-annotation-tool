import { existsSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { config } from '../src/config.ts'
import { prisma } from '../src/db.ts'
import { api, resetDb, uploadWav } from './helpers/api.ts'
import { synthWav } from './helpers/synthWav.ts'

beforeEach(resetDb)

describe('POST /api/audio', () => {
  it('routes recordings over 15 seconds to a human and auto-rejects the rest', async () => {
    const long = await uploadWav('long.wav', { seconds: 20 }).expect(201)
    expect(long.body).toMatchObject({ filename: 'long.wav', status: 'PENDING' })
    expect(long.body.durationSec).toBeCloseTo(20, 2)

    const short = await uploadWav('short.wav', { seconds: 3 }).expect(201)
    expect(short.body.status).toBe('AUTO_REJECTED')

    const boundary = await uploadWav('boundary.wav', { seconds: 15 }).expect(201)
    expect(boundary.body.status).toBe('AUTO_REJECTED')

    const justOver = await uploadWav('just-over.wav', { seconds: 15.1 }).expect(201)
    expect(justOver.body.status).toBe('PENDING')
  })

  it('ignores any duration the client claims', async () => {
    const res = await api()
      .post('/api/audio')
      .field('durationSec', '999')
      .attach('file', synthWav({ seconds: 2 }), 'claimed.wav')
      .expect(201)
    expect(res.body.durationSec).toBeCloseTo(2, 2)
    expect(res.body.status).toBe('AUTO_REJECTED')
  })

  it('stores the file on disk and only a reference in the database', async () => {
    const { body } = await uploadWav('stored.wav', { seconds: 1 }).expect(201)
    const item = await prisma.item.findUniqueOrThrow({ where: { id: body.itemId } })
    expect(item.storagePath).toMatch(/\.wav$/)
    expect(existsSync(path.join(config.storageDir, item.storagePath))).toBe(true)

    const audio = await api().get(`/api/items/${body.itemId}/audio`).expect(200)
    expect(audio.headers['content-type']).toMatch(/audio\/wav/)
    const partial = await api()
      .get(`/api/items/${body.itemId}/audio`)
      .set('Range', 'bytes=0-99')
      .expect(206)
    expect(partial.headers['content-length']).toBe('100')
  })

  it('reads header facts and levels server-side', async () => {
    const { body } = await uploadWav('facts.wav', {
      seconds: 1,
      sampleRate: 44100,
      channels: 2,
      bitDepth: 24,
      info: { IART: 'Dr. Test' },
    }).expect(201)
    const detail = await api().get(`/api/items/${body.itemId}`).expect(200)
    expect(detail.body.recording).toMatchObject({
      sampleRate: 44100,
      channels: 2,
      bitDepth: 24,
      container: 'WAVE',
      metadata: { IART: 'Dr. Test' },
      levelsError: null,
    })
    expect(detail.body.recording.levels.peakDbfs).toBe(-120)
  })

  it.each(['short.mp3', 'short.m4a'])('accepts %s and reads its facts', async (name) => {
    const file = path.join(import.meta.dirname, 'fixtures', name)
    const { body } = await api().post('/api/audio').attach('file', file).expect(201)
    expect(body.status).toBe('AUTO_REJECTED')
    expect(body.durationSec).toBeCloseTo(1.5, 0)
    const { body: detail } = await api().get(`/api/items/${body.itemId}`).expect(200)
    expect(detail.recording).toMatchObject({ sampleRate: 16000, channels: 1, bitDepth: null })
    // Levels need ffmpeg for lossy formats; without it the item says so instead of failing.
    if (detail.recording.levels === null) expect(detail.recording.levelsError).toMatch(/ffmpeg/)
    else expect(detail.recording.levels.snrDb).toBeGreaterThan(0)
  })

  it('rejects a file whose extension does not match its content', async () => {
    const mp3 = path.join(import.meta.dirname, 'fixtures', 'short.mp3')
    const res = await api().post('/api/audio').attach('file', mp3, 'renamed.wav').expect(415)
    expect(res.body.error).toMatch(/not a readable WAV, MP3 or M4A/)
    expect(await prisma.item.count()).toBe(0)
  })

  it('answers malformed multipart bodies with 400, not 500', async () => {
    const boundary = 'x'
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a\u0000.wav"\r\n\r\n`),
      synthWav({ seconds: 0.1 }),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ])
    const res = await api()
      .post('/api/audio')
      .set('Content-Type', `multipart/form-data; boundary=${boundary}`)
      .send(body)
      .expect(400)
    expect(res.body.error).toMatch(/Upload rejected/)
    expect(await prisma.item.count()).toBe(0)
  })

  it('answers a wrong multipart field name with 400', async () => {
    const res = await api().post('/api/audio').attach('audio', synthWav({ seconds: 0.1 }), 'a.wav').expect(400)
    expect(res.body.error).toMatch(/Upload rejected: Unexpected field/)
  })

  it('rejects unsupported extensions before storing anything', async () => {
    const res = await api()
      .post('/api/audio')
      .attach('file', Buffer.from('x'), 'notes.txt')
      .expect(415)
    expect(res.body.error).toMatch(/\.wav, \.mp3 or \.m4a/)
    expect(await prisma.item.count()).toBe(0)
  })

  it('rejects files whose content is not audio, and cleans up', async () => {
    const res = await api()
      .post('/api/audio')
      .attach('file', Buffer.from('not audio'), 'fake.wav')
      .expect(415)
    expect(res.body.error).toMatch(/not a readable/)
    expect(await prisma.item.count()).toBe(0)
  })

  it('rejects a second upload with the same filename', async () => {
    await uploadWav('dup.wav', { seconds: 1 }).expect(201)
    const res = await uploadWav('dup.wav', { seconds: 1 }).expect(409)
    expect(res.body.error).toMatch(/already uploaded/)
  })

  it('rejects files over the size limit with a clear message', async () => {
    // 40 s at 16 kHz mono 16-bit is 1.28 MB, over the 1 MB limit configured for tests.
    const res = await uploadWav('big.wav', { seconds: 40 }).expect(413)
    expect(res.body.error).toMatch(/1 MB upload limit/)
    expect(await prisma.item.count()).toBe(0)
  })
})

describe('GET /api/items', () => {
  it('lists filename, duration, status and annotator', async () => {
    await uploadWav('a.wav', { seconds: 16 })
    await uploadWav('b.wav', { seconds: 2 })
    const { body } = await api().get('/api/items').expect(200)
    expect(body).toHaveLength(2)
    expect(body[0]).toMatchObject({
      filename: 'a.wav',
      status: 'PENDING',
      annotator: null,
      hasTranscript: false,
    })
    expect(body[1]).toMatchObject({ filename: 'b.wav', status: 'AUTO_REJECTED' })
  })
})
